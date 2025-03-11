import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

@Injectable()
export class PrometheusService {
	private readonly registry: Registry;
	private readonly counters: Map<string, Counter>;
	private readonly histograms: Map<string, Histogram>;

	constructor() {
		this.registry = new Registry();
		this.counters = new Map();
		this.histograms = new Map();

		this.setupMetrics();
	}

	private setupMetrics() {
		// Click metrics
		this.createCounter('click_events_received', 'Total click events received');
		this.createCounter('click_processing_errors', 'Total click processing errors');

		// Performance metrics
		this.createHistogram('click_batch_processing_duration', 'Click batch processing duration in milliseconds');

		// Error metrics
		this.createCounter('kafka_errors', 'Total Kafka errors');
		this.createCounter('database_errors', 'Total database errors');
	}

	createCounter(name: string, help: string) {
		const counter = new Counter({ name, help });
		this.registry.registerMetric(counter);
		this.counters.set(name, counter);
	}

	createHistogram(name: string, help: string) {
		const histogram = new Histogram({ name, help });
		this.registry.registerMetric(histogram);
		this.histograms.set(name, histogram);
	}

	incrementCounter(name: string, value = 1) {
		const counter = this.counters.get(name);
		if (counter) counter.inc(value);
	}

	observeHistogram(name: string, value: number) {
		const histogram = this.histograms.get(name);
		if (histogram) histogram.observe(value);
	}

	async getMetrics() {
		return this.registry.metrics();
	}
}
