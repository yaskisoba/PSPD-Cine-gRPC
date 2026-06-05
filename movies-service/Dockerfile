FROM golang:1.22 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler && \
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.33.0 && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.3.0 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY proto/ /proto/
RUN mkdir -p /src/movies-service/generated && \
    protoc \
      -I /proto \
      --go_out=/src/movies-service/generated \
      --go_opt=paths=source_relative \
      --go-grpc_out=/src/movies-service/generated \
      --go-grpc_opt=paths=source_relative \
      /proto/movies.proto

COPY movies-service/go.mod ./movies-service/
WORKDIR /src/movies-service

COPY movies-service/ .
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /movies-service .

FROM gcr.io/distroless/static:nonroot

COPY --from=builder /movies-service /movies-service

EXPOSE 50051

CMD ["/movies-service"]
