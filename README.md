# CineGRPC

**Catálogo de Filmes com Microserviços gRPC + Kubernetes**

---

Universidade de Brasília – UnB / FCTE  
Engenharia de Software  
PSPD – Programação para Sistemas Paralelos e Distribuídos  
Prof. Fernando W. Cruz  
2024/2025

| Matrícula | Aluno |
|-----------|-------|
| —         | Aluno 1 |
| —         | Aluno 2 |
| —         | Aluno 3 |
| —         | Aluno 4 |

---

## Sobre o Projeto

O CineGRPC é um catálogo de filmes distribuído implementado sobre uma arquitetura de microserviços baseada no framework **gRPC**. A aplicação é composta por três módulos colaborativos implantados em containers gerenciados pelo **Kubernetes (Minikube)**:

- **Módulo A** (`movies-service`) — serviço de filmes em **Go**, servidor gRPC na porta 50051
- **Módulo B** (`reviews-service`) — serviço de avaliações em **Node.js**, servidor gRPC na porta 50052
- **Módulo P** (`gateway`) — API Gateway em **Python/FastAPI**, traduz REST → gRPC na porta 8000
- **Frontend** — SPA em **React + Vite**, interface web na porta 3000

O projeto demonstra os **quatro tipos de comunicação gRPC**: Unary, Server Streaming, Client Streaming e Bidirectional Streaming.

---

## Stack Tecnológica

| Módulo            | Tecnologia       | Função                          | Porta       |
|-------------------|------------------|---------------------------------|-------------|
| Frontend          | React + Vite     | Interface Web (HClient)         | 3000 (HTTP) |
| Gateway – P       | Python + FastAPI | API Gateway + gRPC Stub         | 8000 (HTTP) |
| Movies Service – A | Go (Golang)     | Catálogo de filmes (gRPC Server) | 50051 (gRPC) |
| Reviews Service – B | Node.js        | Avaliações e notas (gRPC Server) | 50052 (gRPC) |

---

## Como Rodar

### Com Docker Compose (recomendado)

```bash
docker-compose up --build
```

Acesse:
- Frontend: http://localhost:3000
- API REST / Swagger: http://localhost:8000/docs

### Com Minikube (Kubernetes)

```bash
minikube start --driver=docker
minikube docker-env | Invoke-Expression   # Windows PowerShell

docker build -t cinegrpc/movies-service:latest  -f movies-service/Dockerfile .
docker build -t cinegrpc/reviews-service:latest reviews-service/
docker build -t cinegrpc/gateway:latest         gateway/
docker build -t cinegrpc/frontend:latest        frontend/

kubectl apply -f k8s/deployment.yaml
minikube service frontend-service -n cinegrpc --url
```

---

## Estrutura do Repositório

```
PSPD-Cine-gRPC/
├── proto/                    # Contratos gRPC compartilhados (.proto)
├── movies-service/           # Módulo A – Go (gRPC Server :50051)
│   └── generated/            # Stubs gerados pelo protoc
├── reviews-service/          # Módulo B – Node.js (gRPC Server :50052)
├── gateway/                  # Módulo P – Python + FastAPI (REST :8000)
│   └── generated/            # Stubs gerados pelo protoc
├── frontend/                 # React + Vite (SPA :3000)
│   ├── src/
│   │   ├── api/              # Cliente HTTP (Axios)
│   │   ├── components/       # MovieCard, AddReviewForm
│   │   └── pages/            # HomePage, MovieDetailPage
│   └── public/
├── k8s/                      # Manifests Kubernetes
├── docker-compose.yml        # Dev local
├── generate_proto.sh         # Gera stubs gRPC para Go e Python
└── README.md
```

---

## Tipos de Comunicação gRPC Implementados

| Tipo                | Serviço       | Método             | Descrição                          |
|---------------------|---------------|--------------------|------------------------------------|
| Unary               | Movies (A)    | `GetMovie`         | Busca um filme por ID              |
| Unary               | Movies (A)    | `CreateMovie`      | Cria um novo filme                 |
| Unary               | Reviews (B)   | `AddReview`        | Adiciona uma avaliação             |
| Unary               | Reviews (B)   | `GetMovieRating`   | Retorna nota média do filme        |
| Server Streaming    | Movies (A)    | `ListMovies`       | Lista filmes com filtro de gênero  |
| Server Streaming    | Reviews (B)   | `GetMovieReviews`  | Lista avaliações de um filme       |
| Client Streaming    | Movies (A)    | `BulkImportMovies` | Importa múltiplos filmes em lote   |
| Bidirectional       | Reviews (B)   | `LiveReviewSession`| Sessão de avaliação em tempo real  |

---

## Licença

Projeto acadêmico — Universidade de Brasília, 2024/2025.
