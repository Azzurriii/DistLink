# DistLink - URL Shorten System

## Overview
This project is a **high-performance, distributed URL shortener** built using **NestJS, ScyllaDB, Kafka, Redis, and Kubernetes**. The system is designed to handle **millions of requests per second**, providing **fast URL redirects, real-time analytics, and anti-spam protection**.

## System Architecture
The architecture is designed for **high scalability, fault tolerance, and low latency**. Below is a breakdown of the key components:

![System Architecture](system.png)

### **1. Edge Layer (Security & Rate Limiting)**
- **Cloudflare WAF**
  - Protects against DDoS attacks and bot traffic.
  - Implements rate limiting.

### **2. API Layer (NestJS Microservice)**
- **NestJS Application**
  - Handles URL shortening and redirection.
  - Exposes REST API endpoints.
  - Implements caching with Redis.
  - Produces click events to Kafka.

### **3. Database Layer (Scalable Storage)**
- **ScyllaDB (NoSQL Database)**
  - High-throughput storage for URL mappings.
  - Uses a **partition key (short_code)** for fast lookups.
  - Implements **TTL** to auto-expire links.

### **4. Caching Layer (Performance Optimization)**
- **Redis**
  - Stores frequently accessed URL mappings.
  - Reduces database load for high-traffic URLs.

### **5. Event Processing & Analytics**
- **Kafka Cluster**
  - Kafka Producers send click tracking events.
  - Kafka Consumers process and store analytics data.
- **ClickHouse (Analytics Database)**
  - Stores user click events for real-time reporting.
  - Supports **high-speed aggregations and queries**.

### **6. Deployment & Orchestration**
- **Docker**
  - Containerizes all services for easy deployment.
- **Kubernetes (K8s)**
  - Manages containerized services.
  - Ensures **auto-scaling, self-healing, and rolling updates**.
- **Ingress Controller (Traefik/Nginx)**
  - Manages HTTP traffic into the Kubernetes cluster.

## Workflow
### **1. Shorten URL (`POST /shorten`)**
1. API receives a long URL.
2. Cloudflare WAF filters request.
3. NestJS generates a **short_code** and checks Redis cache.
4. If not found, stores the URL in ScyllaDB and updates Redis.
5. Returns the shortened URL.

### **2. Redirect URL (`GET /:short_code`)**
1. User accesses a short URL.
2. Cloudflare WAF filters traffic.
3. NestJS checks Redis cache for the original URL.
4. If cache miss, fetches from ScyllaDB and caches result.
5. Logs click event to Kafka.
6. Redirects user to the original URL.

### **3. Track Clicks (Kafka Consumer & ClickHouse)**
1. Kafka Consumer listens for click events.
2. Stores click metadata (IP, user-agent, timestamp, referrer) in ClickHouse.
3. Real-time dashboards query analytics data.

## Deployment Guide
### **1. Local Development (Docker Compose)**
```sh
docker-compose up -d
```

### **2. Production Deployment (Kubernetes)**
```sh
kubectl apply -f k8s/
```

### **3. Scaling Services**
- **NestJS API**: Horizontal Pod Autoscaler (HPA)
- **ScyllaDB**: StatefulSet for high availability
- **Kafka**: Multi-broker setup for fault tolerance

## Future Enhancements
- Implement **GraphQL API** for better flexibility.
- Add **AI-based spam detection** using machine learning.
- Integrate **multi-region replication** for global performance.
