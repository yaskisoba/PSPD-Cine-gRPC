#!/usr/bin/env python3
"""
Benchmark: gRPC Gateway vs REST Gateway - CineGRPC
Compara o desempenho dos dois backends sob os mesmos cenários.

Pré-requisitos:
    pip install httpx

Uso:
    python scripts/benchmark.py [--host HOST] [--port PORT] [--n N] [--concurrency C]

Defaults: host=localhost, port=8000, n=100, concurrency=20
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from typing import Any

import httpx


parser = argparse.ArgumentParser(description="Benchmark gRPC vs REST - CineGRPC")
parser.add_argument("--host", default="localhost", help="Gateway host (default: localhost)")
parser.add_argument("--port", default=8000, type=int, help="Gateway port (default: 8000)")
parser.add_argument("--n", default=100, type=int, help="Requisições por cenário (default: 100)")
parser.add_argument("--concurrency", default=20, type=int, help="Concorrência no teste C5 (default: 20)")
parser.add_argument("--warmup", default=5, type=int, help="Requisições de aquecimento (default: 5)")
args = parser.parse_args()

BASE = f"http://{args.host}:{args.port}"
N = args.n
CONC = args.concurrency
WARMUP = args.warmup

GRPC_PREFIX = ""
REST_PREFIX = "/rest"


RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
RED = "\033[31m"


def _fmt(val: float, unit: str = "ms") -> str:
    return f"{val:.2f} {unit}"


def _winner(grpc_val: float, rest_val: float) -> tuple[str, str]:
    """Return (grpc_tag, rest_tag) with colour highlighting the faster one."""
    if grpc_val < rest_val:
        return f"{GREEN}{_fmt(grpc_val)}{RESET}", f"{_fmt(rest_val)}"
    elif rest_val < grpc_val:
        return f"{_fmt(grpc_val)}", f"{GREEN}{_fmt(rest_val)}{RESET}"
    return _fmt(grpc_val), _fmt(rest_val)


def print_header(title: str) -> None:
    width = 70
    print(f"\n{BOLD}{CYAN}{'─' * width}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─' * width}{RESET}")


def print_table(rows: list[dict]) -> None:
    col_w = [28, 14, 14, 14, 14, 14]
    headers = ["Cenário", "gRPC avg", "REST avg", "gRPC p95", "REST p95", "Ganho"]
    sep = "  ".join("─" * w for w in col_w)
    header_line = "  ".join(h.ljust(w) for h, w in zip(headers, col_w))
    print(f"\n{BOLD}{header_line}{RESET}")
    print(sep)
    for r in rows:
        grpc_avg = r["grpc"]["mean"]
        rest_avg = r["rest"]["mean"]
        grpc_p95 = r["grpc"]["p95"]
        rest_p95 = r["rest"]["p95"]

        faster = "gRPC" if grpc_avg < rest_avg else "REST"
        pct    = abs(grpc_avg - rest_avg) / max(grpc_avg, rest_avg) * 100
        gain   = f"{faster} {pct:.0f}% mais rápido"

        g_avg_s, r_avg_s = _winner(grpc_avg, rest_avg)
        g_p95_s, r_p95_s = _winner(grpc_p95, rest_p95)

        cols = [
            r["name"].ljust(col_w[0]),
            g_avg_s.ljust(col_w[1] + 10), 
            r_avg_s.ljust(col_w[2] + 10),
            g_p95_s.ljust(col_w[3] + 10),
            r_p95_s.ljust(col_w[4] + 10),
            gain,
        ]
        print("  ".join(cols))
    print(sep)


def measure_sync(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    json_body: Any = None,
    n: int = N,
    warmup: int = WARMUP,
) -> dict:
    """Run `n` sequential requests and return latency stats (ms)."""
    for _ in range(warmup):
        if method == "GET":
            client.get(url)
        else:
            client.post(url, json=json_body)

    latencies: list[float] = []
    for _ in range(n):
        t0 = time.perf_counter()
        if method == "GET":
            r = client.get(url)
        else:
            r = client.post(url, json=json_body)
        elapsed = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed)
        if r.status_code >= 500:
            print(f"  {RED}ERRO {r.status_code}{RESET}: {url}", file=sys.stderr)

    return _stats(latencies, n)


async def measure_concurrent(
    method: str,
    url: str,
    *,
    json_body: Any = None,
    n: int = N,
    concurrency: int = CONC,
    warmup: int = WARMUP,
) -> dict:
    """Run `n` requests with `concurrency` concurrent workers and return stats."""
    async with httpx.AsyncClient(timeout=30) as client:
        # warmup
        for _ in range(warmup):
            if method == "GET":
                await client.get(url)
            else:
                await client.post(url, json=json_body)

        sem = asyncio.Semaphore(concurrency)
        latencies: list[float] = []
        errors = 0

        async def _one() -> float:
            async with sem:
                t0 = time.perf_counter()
                if method == "GET":
                    r = await client.get(url)
                else:
                    r = await client.post(url, json=json_body)
                elapsed = (time.perf_counter() - t0) * 1000
                if r.status_code >= 500:
                    nonlocal errors
                    errors += 1
                return elapsed

        wall_start = time.perf_counter()
        results = await asyncio.gather(*[_one() for _ in range(n)])
        wall_elapsed = time.perf_counter() - wall_start

        latencies = list(results)
        stats = _stats(latencies, n)
        stats["throughput"] = n / wall_elapsed
        stats["errors"]     = errors
        return stats


def _stats(latencies: list[float], n: int) -> dict:
    s = sorted(latencies)
    return {
        "mean": statistics.mean(latencies),
        "median": statistics.median(latencies),
        "p95": s[int(0.95 * n) - 1],
        "p99": s[int(0.99 * n) - 1],
        "min": s[0],
        "max": s[-1],
        "n": n,
    }


def print_detail(label: str, stats: dict) -> None:
    thr = f" | throughput: {stats['throughput']:.1f} req/s" if "throughput" in stats else ""
    err = f" | erros: {stats['errors']}" if stats.get("errors") else ""
    print(
        f" {BOLD}{label}{RESET}: "
        f"avg={_fmt(stats['mean'])}  "
        f"med={_fmt(stats['median'])}  "
        f"p95={_fmt(stats['p95'])}  "
        f"p99={_fmt(stats['p99'])}  "
        f"min={_fmt(stats['min'])}  "
        f"max={_fmt(stats['max'])}"
        f"{thr}{err}"
    )



def run_all() -> None:
    print(f"\n{BOLD}CineGRPC - Benchmark gRPC vs REST{RESET}")
    print(f"Gateway: {BASE}  |  N={N}  |  warmup={WARMUP}  |  concorrência={CONC}")

    try:
        httpx.get(f"{BASE}/health", timeout=5).raise_for_status()
    except Exception as e:
        print(f"\n{RED}Gateway não está acessível em {BASE}: {e}{RESET}")
        print("Suba os serviços com:  docker compose up --build")
        sys.exit(1)

    summary_rows: list[dict] = []

    with httpx.Client(timeout=15) as client:

        print_header("C1 - Leitura simples: GET /movies/1  (GetMovie - Unary)")
        grpc_c1 = measure_sync(client, "GET", f"{BASE}{GRPC_PREFIX}/movies/1")
        rest_c1 = measure_sync(client, "GET", f"{BASE}{REST_PREFIX}/movies/1")
        print_detail("gRPC", grpc_c1)
        print_detail("REST", rest_c1)
        summary_rows.append({"name": "C1 Leitura simples", "grpc": grpc_c1, "rest": rest_c1})

        print_header("C2 - Leitura agregada: GET /movies/1  (GetMovie + Rating + Reviews)")
        grpc_c2 = measure_sync(client, "GET", f"{BASE}{GRPC_PREFIX}/movies/1")
        rest_c2 = measure_sync(client, "GET", f"{BASE}{REST_PREFIX}/movies/1")
        print_detail("gRPC", grpc_c2)
        print_detail("REST", rest_c2)
        summary_rows.append({"name": "C2 Leitura agregada", "grpc": grpc_c2, "rest": rest_c2})

        print_header("C3 - Listagem: GET /movies  (ListMovies - Server Streaming)")
        grpc_c3 = measure_sync(client, "GET", f"{BASE}{GRPC_PREFIX}/movies")
        rest_c3 = measure_sync(client, "GET", f"{BASE}{REST_PREFIX}/movies")
        print_detail("gRPC", grpc_c3)
        print_detail("REST", rest_c3)
        summary_rows.append({"name": "C3 Listagem", "grpc": grpc_c3, "rest": rest_c3})

        print_header("C4 - Escrita: POST /movies  (CreateMovie - Unary)")
        new_movie = {
            "title": "Filme Benchmark",
            "genre": "Teste",
            "year": 2024,
            "director": "Bot",
            "synopsis": "Criado pelo benchmark",
            "cast": [],
        }
        grpc_c4 = measure_sync(client, "POST", f"{BASE}{GRPC_PREFIX}/movies", json_body=new_movie)
        rest_c4 = measure_sync(client, "POST", f"{BASE}{REST_PREFIX}/movies", json_body=new_movie)
        print_detail("gRPC", grpc_c4)
        print_detail("REST", rest_c4)
        summary_rows.append({"name": "C4 Escrita", "grpc": grpc_c4, "rest": rest_c4})

    print_header(f"C5 - Carga concorrente: {N} reqs  concorrência={CONC}  (GET /movies/1)")
    grpc_c5 = asyncio.run(
        measure_concurrent("GET", f"{BASE}{GRPC_PREFIX}/movies/1", n=N, concurrency=CONC)
    )
    rest_c5 = asyncio.run(
        measure_concurrent("GET", f"{BASE}{REST_PREFIX}/movies/1", n=N, concurrency=CONC)
    )
    print_detail("gRPC", grpc_c5)
    print_detail("REST", rest_c5)
    summary_rows.append({"name": "C5 Carga concorrente", "grpc": grpc_c5, "rest": rest_c5})

    print_header("Resumo comparativo  (latência média em ms - menor é melhor)")
    print_table(summary_rows)

    print(f"\n{BOLD}Throughput C5 (req/s):{RESET}")
    g_thr = grpc_c5.get("throughput", 0)
    r_thr = rest_c5.get("throughput", 0)
    winner_thr = "gRPC" if g_thr > r_thr else "REST"
    print(
        f"  gRPC: {g_thr:.1f} req/s   "
        f"REST: {r_thr:.1f} req/s   "
        f"→ {BOLD}{GREEN}{winner_thr}{RESET} entregou mais requisições por segundo"
    )

    out_path = "scripts/benchmark_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "config": {"host": args.host, "port": args.port, "n": N, "concurrency": CONC},
                "results": {r["name"]: {"grpc": r["grpc"], "rest": r["rest"]} for r in summary_rows},
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\n{CYAN}Resultados salvos em {out_path}{RESET}\n")


if __name__ == "__main__":
    run_all()
