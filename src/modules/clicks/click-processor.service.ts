import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PrometheusService } from '../monitoring/prometheus.service';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

interface ClickEvent {
  shortCode: string;
  timestamp: Date;
  metadata: {
    userAgent?: string;
    ip?: string;
    referer?: string;
    country?: string;
  };
}

interface AnalyticsEvent {
  shortCode: string;
  timestamp: Date;
  metadata: any;
}

@Injectable()
export class ClickProcessorService implements OnModuleDestroy {
  private readonly logger = new Logger(ClickProcessorService.name);
  private clickBuffer: ClickEvent[] = [];
  private analyticsBuffer: AnalyticsEvent[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;
  private readonly DEAD_LETTER_THRESHOLD = 3;
  private processingInterval: NodeJS.Timeout;
  private deadLetterQueue: Map<string, { event: any; failures: number }> =
    new Map();

  constructor(
    private readonly dbService: DatabaseService,
    private readonly monitoring: PrometheusService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {
    this.startPeriodicFlush();
  }

  onModuleDestroy() {
    clearInterval(this.processingInterval);
    // Flush remaining events before shutdown
    return this.flushAllBuffers();
  }

  async processClickEvent(event: ClickEvent) {
    this.clickBuffer.push(event);
    this.monitoring.incrementCounter('clicks_received');

    if (this.clickBuffer.length >= this.BATCH_SIZE) {
      await this.flushClickBuffer();
    }
  }

  async processAnalyticsEvent(event: AnalyticsEvent) {
    this.analyticsBuffer.push(event);
    this.monitoring.incrementCounter('analytics_received');

    // Extract and enrich analytics data
    const enrichedData = this.enrichAnalyticsData(event);

    // Store in analytics buffer
    this.analyticsBuffer.push(enrichedData);

    if (this.analyticsBuffer.length >= this.BATCH_SIZE) {
      await this.flushAnalyticsBuffer();
    }
  }

  private enrichAnalyticsData(event: AnalyticsEvent): AnalyticsEvent {
    // Extract user agent info
    const userAgent = event.metadata?.userAgent;
    const ip = event.metadata?.ip;

    // Enrich with device info
    const deviceInfo = this.parseUserAgent(userAgent);

    // Enrich with geo info if available
    const geoInfo = ip ? this.getGeoInfo(ip) : null;

    return {
      ...event,
      metadata: {
        ...event.metadata,
        device: deviceInfo,
        geo: geoInfo,
        processedAt: new Date(),
      },
    };
  }

  private parseUserAgent(userAgent: string): any {
    if (!userAgent) return { unknown: true };

    // Simple UA parsing - in production use a proper UA parser library
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);
    const isBrowser = /chrome|firefox|safari|edge|msie|trident/i.test(
      userAgent,
    );

    return {
      isMobile,
      isTablet,
      isBrowser,
      raw: userAgent.substring(0, 200), // Truncate for storage efficiency
    };
  }

  private getGeoInfo(ip: string): any {
    // In production, use a proper geo-IP service
    // This is a placeholder implementation
    return {
      approximateLocation: 'unknown',
      ip: this.anonymizeIp(ip),
    };
  }

  private anonymizeIp(ip: string): string {
    // Simple IP anonymization - replace last octet with 0
    return ip.replace(/\d+$/, '0');
  }

  private async flushAllBuffers() {
    await Promise.allSettled([
      this.flushClickBuffer(),
      this.flushAnalyticsBuffer(),
      this.processDeadLetterQueue(),
    ]);
  }

  private async flushClickBuffer() {
    if (this.clickBuffer.length === 0) return;

    const batch = this.clickBuffer.splice(0, this.BATCH_SIZE);
    const startTime = Date.now();

    try {
      await this.saveBatchToDatabase(batch);
      this.monitoring.observeHistogram(
        'click_processing_duration',
        Date.now() - startTime,
      );
    } catch (error) {
      this.logger.error('Failed to process click batch', error);
      this.monitoring.incrementCounter('click_processing_errors');

      // Move failed events to dead letter queue
      batch.forEach((event) => {
        const key = `click:${event.shortCode}:${event.timestamp.getTime()}`;
        const existing = this.deadLetterQueue.get(key);

        if (existing) {
          existing.failures += 1;
        } else {
          this.deadLetterQueue.set(key, { event, failures: 1 });
        }
      });
    }
  }

  private async flushAnalyticsBuffer() {
    if (this.analyticsBuffer.length === 0) return;

    const batch = this.analyticsBuffer.splice(0, this.BATCH_SIZE);
    const startTime = Date.now();

    try {
      await this.saveAnalyticsBatch(batch);
      this.monitoring.observeHistogram(
        'analytics_processing_duration',
        Date.now() - startTime,
      );
    } catch (error) {
      this.logger.error('Failed to process analytics batch', error);
      this.monitoring.incrementCounter('analytics_processing_errors');

      // Move failed events to dead letter queue
      batch.forEach((event) => {
        const key = `analytics:${event.shortCode}:${event.timestamp.getTime()}`;
        const existing = this.deadLetterQueue.get(key);

        if (existing) {
          existing.failures += 1;
        } else {
          this.deadLetterQueue.set(key, { event, failures: 1 });
        }
      });
    }
  }

  private async processDeadLetterQueue() {
    if (this.deadLetterQueue.size === 0) return;

    // Process items that haven't exceeded retry threshold
    const retryItems: [string, { event: any; failures: number }][] = [];
    const failedItems: [string, { event: any; failures: number }][] = [];

    // Split into retry and permanently failed
    this.deadLetterQueue.forEach((value, key) => {
      if (value.failures < this.DEAD_LETTER_THRESHOLD) {
        retryItems.push([key, value]);
      } else {
        failedItems.push([key, value]);
      }
    });

    // Clear processed items from queue
    retryItems.forEach(([key]) => this.deadLetterQueue.delete(key));
    failedItems.forEach(([key]) => this.deadLetterQueue.delete(key));

    // Process retries
    if (retryItems.length > 0) {
      const clickEvents = retryItems
        .filter(([key]) => key.startsWith('click:'))
        .map(([, value]) => value.event);

      const analyticsEvents = retryItems
        .filter(([key]) => key.startsWith('analytics:'))
        .map(([, value]) => value.event);

      if (clickEvents.length > 0) {
        try {
          await this.saveBatchToDatabase(clickEvents);
        } catch (error) {
          // Put back in queue with increased failure count
          clickEvents.forEach((event) => {
            const key = `click:${event.shortCode}:${event.timestamp.getTime()}`;
            this.deadLetterQueue.set(key, {
              event,
              failures:
                (retryItems.find(([k]) => k === key)?.[1].failures || 0) + 1,
            });
          });
        }
      }

      if (analyticsEvents.length > 0) {
        try {
          await this.saveAnalyticsBatch(analyticsEvents);
        } catch (error) {
          // Put back in queue with increased failure count
          analyticsEvents.forEach((event) => {
            const key = `analytics:${event.shortCode}:${event.timestamp.getTime()}`;
            this.deadLetterQueue.set(key, {
              event,
              failures:
                (retryItems.find(([k]) => k === key)?.[1].failures || 0) + 1,
            });
          });
        }
      }
    }

    // Log permanently failed items
    if (failedItems.length > 0) {
      this.logger.warn(
        `${failedItems.length} events failed processing after ${this.DEAD_LETTER_THRESHOLD} attempts`,
      );

      // Send to error topic for manual inspection
      await Promise.allSettled(
        failedItems.map(([key, value]) =>
          this.kafkaProducer.sendErrorEvent({
            code: 'PERMANENT_PROCESSING_FAILURE',
            message: `Failed to process event after ${value.failures} attempts`,
            metadata: {
              eventType: key.split(':')[0],
              shortCode: value.event.shortCode,
              event: value.event,
            },
          }),
        ),
      );
    }
  }

  private async saveBatchToDatabase(
    batch: ClickEvent[],
    retries = this.MAX_RETRIES,
  ) {
    const client = this.dbService.getClient();
    const queries = batch.map((click) => ({
      query: 'UPDATE url_clicks SET clicks = clicks + 1 WHERE short_code = ?',
      params: [click.shortCode],
    }));

    try {
      await client.batch(queries, { prepare: true });
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(`Retrying batch save, attempts left: ${retries - 1}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.saveBatchToDatabase(batch, retries - 1);
      }
      throw error;
    }
  }

  private async saveAnalyticsBatch(
    batch: AnalyticsEvent[],
    retries = this.MAX_RETRIES,
  ) {
    const client = this.dbService.getClient();

    // Group by day for time-series data
    const byDay = new Map<string, AnalyticsEvent[]>();

    batch.forEach((event) => {
      const day = new Date(event.timestamp).toISOString().split('T')[0];
      const key = `${event.shortCode}:${day}`;

      if (!byDay.has(key)) {
        byDay.set(key, []);
      }

      byDay.get(key)!.push(event);
    });

    // Create queries for aggregated analytics
    const queries = [];

    // Insert detailed events
    queries.push(
      ...batch.map((event) => ({
        query: `
        INSERT INTO url_analytics (
          short_code, 
          timestamp, 
          user_agent, 
          ip, 
          referer, 
          device_type, 
          country
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        params: [
          event.shortCode,
          event.timestamp,
          event.metadata?.userAgent || null,
          event.metadata?.ip ? this.anonymizeIp(event.metadata.ip) : null,
          event.metadata?.referer || null,
          event.metadata?.device?.isMobile
            ? 'mobile'
            : event.metadata?.device?.isTablet
              ? 'tablet'
              : 'desktop',
          event.metadata?.geo?.approximateLocation || null,
        ],
      })),
    );

    // Update aggregated stats
    byDay.forEach((events, key) => {
      const [shortCode, day] = key.split(':');

      // Count by device type
      const deviceCounts = {
        mobile: 0,
        tablet: 0,
        desktop: 0,
      };

      events.forEach((event) => {
        if (event.metadata?.device?.isMobile) deviceCounts.mobile++;
        else if (event.metadata?.device?.isTablet) deviceCounts.tablet++;
        else deviceCounts.desktop++;
      });

      queries.push({
        query: `
          UPDATE url_analytics_daily SET 
            total_clicks = total_clicks + ?, 
            mobile_clicks = mobile_clicks + ?,
            tablet_clicks = tablet_clicks + ?,
            desktop_clicks = desktop_clicks + ?
          WHERE short_code = ? AND day = ?
        `,
        params: [
          events.length,
          deviceCounts.mobile,
          deviceCounts.tablet,
          deviceCounts.desktop,
          shortCode,
          day,
        ],
      });
    });

    try {
      await client.batch(queries, { prepare: true });
    } catch (error) {
      if (retries > 0) {
        this.logger.warn(
          `Retrying analytics batch save, attempts left: ${retries - 1}`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (this.MAX_RETRIES - retries + 1)),
        );
        return this.saveAnalyticsBatch(batch, retries - 1);
      }
      throw error;
    }
  }

  private startPeriodicFlush() {
    this.processingInterval = setInterval(() => {
      this.flushAllBuffers().catch((error) => {
        this.logger.error('Failed to flush buffers', error);
      });
    }, this.FLUSH_INTERVAL);
  }
}
