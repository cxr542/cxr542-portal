---
title: Streaming Multiprocessor (SM)
slug: streaming-multiprocessor
visibility: published
source_url: https://docs.nvidia.com/cuda/cuda-c-programming-guide/
collected_at: 2026-09-07
tags:
  - topic
  - gpu
  - hardware
  - cuda
  - nvidia
related:
  - kind: topics
    slug: gemini
  - kind: topics
    slug: harness-engineering
---

# Streaming Multiprocessor (SM)

**SM(Streaming Multiprocessor)**은 NVIDIA GPU에서 실질적인 연산과 스케줄링을 담당하는 핵심 하드웨어 연산 단위입니다. CPU에 여러 개의 'CPU 코어'가 모여 있듯, 하나의 GPU 칩셋 안에는 수십~수백 개의 SM이 병렬로 탑재되어 대규모 연산을 분할 처리합니다.

## 한 줄 정의

NVIDIA GPU에서 대규모 병렬 연산 및 스레드/워프(Warp) 스케줄링을 전담하는 **핵심 하드웨어 연산 단위**.

## 주요 구성 요소

| 구성 요소 | 설명 |
|-----------|------|
| **연산 유닛 (Cores)** | 부동소수점/정수 연산을 수행하는 CUDA 코어, AI 딥러닝 행렬 연산에 특화된 Tensor 코어, 그래픽 가속을 위한 RT(Ray Tracing) 코어 등이 포함됩니다. |
| **Warp Scheduler & Dispatch Unit** | 스레드 32개 묶음인 'Warp(워프)'를 관리하고 명령어를 실행 유닛으로 할당합니다. |
| **Register File** | 스레드 실행 시 변수 데이터를 초고속으로 저장·접근하는 레지스터 공간입니다. |
| **L1 Cache / Shared Memory (SMEM)** | SM 내부의 코어들이 데이터를 신속하게 공유할 수 있는 On-chip 초저지연 메모리입니다. |

## CUDA 프로그래밍 모델과의 관계

- **스레드 블록 매핑**: CUDA 커널을 실행할 때 정의되는 소프트웨어 단위인 Thread Block은 하드웨어 단위인 하나의 SM에 할당되어 처리됩니다.
- **SIMT 실행**: SM은 여러 스레드가 하나의 명령어를 동시에 수행하는 SIMT(Single Instruction, Multiple Threads) 아키텍처를 기반으로 동작합니다.
- **자원 독립성**: MIG(Multi-Instance GPU)나 vGPU 분할 시, SM 슬라이스와 메모리 대역폭을 물리적으로 묶어 격리(Isolation)하는 하드웨어 기준 단위가 되기도 합니다.

## 핵심 아키텍처 요약

| 구분 | 소프트웨어 (Software) | 하드웨어 (Hardware) |
|------|-----------------------|---------------------|
| 기본 실행 단위 | Thread | CUDA Core |
| 스케줄링 단위 | Warp (32 Threads) | Warp Scheduler & Dispatcher |
| 블록 단위 | Thread Block | Streaming Multiprocessor (SM) |
| 전체 단위 | Grid / Kernel Launch | GPU Device (Chip) |

## 출처

- [NVIDIA CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/)