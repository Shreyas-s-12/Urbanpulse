# UrbanPulse AI & Intelligence Layer (`ai/`)

This directory houses the machine learning models, computer vision inference pipelines, autonomous municipal agents, RAG engines, and predictive analytics powering UrbanPulse.

## Directory Structure

```
ai/
├── agents/       # Multi-agent workflows (LangGraph / CrewAI) for incident triage and automated city alerts
├── rag/          # Retrieval-Augmented Generation: localized municipal bylaws, disaster history, ward data
├── vision/       # Computer vision models: pothole classification, flood depth, accident severity detection
├── prediction/   # Spatio-temporal forecasting: traffic congestion forecasts, hazard escalation risk
├── embeddings/   # Text and multimodal embedding generation & dimension mapping
├── prompts/      # Catalog of system prompts, agent personalities, and structured output templates
├── evaluation/   # Benchmarking harness, ground-truth validation datasets, and accuracy metrics
└── requirements.txt # AI, CV, and LLM specific dependencies
```

## Architectural Boundaries
- **Inference Separation**: Heavy vision and deep learning inference jobs run asynchronously or via worker queues, separated from the real-time REST API.
- **RAG Granularity**: Vector stores are partitioned by city boundary (Mysuru vs. Bengaluru) to guarantee high-precision regional municipal retrieval.
- **Prompts as Code**: All system prompts and LLM function-calling definitions are version-controlled in `prompts/`.
