FROM python:3.12-slim AS builder

WORKDIR /build

COPY gateway/requirements.txt .
RUN pip install --no-cache-dir grpcio-tools==1.62.1 protobuf==4.25.3

COPY proto/ /proto/

RUN mkdir -p /build/generated

RUN python -m grpc_tools.protoc \
      -I /proto \
      --python_out=/build/generated \
      --grpc_python_out=/build/generated \
      /proto/movies.proto \
      /proto/reviews.proto

RUN touch /build/generated/__init__.py

# ---------------------------------------------------------------------------

FROM python:3.12-slim

WORKDIR /app

COPY gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=builder /build/generated ./generated
COPY gateway/main.py .

ENV MOVIES_SERVICE_ADDR=movies-service:50051
ENV REVIEWS_SERVICE_ADDR=reviews-service:50052

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
