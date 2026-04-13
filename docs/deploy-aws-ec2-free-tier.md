# AWS Free Tier로 EC2에 배포하기 (Ubuntu + Docker)

이 문서는 **AWS 계정 무료 구간(Free Tier)**을 쓰는 전제로, **EC2 한 대**에 [US-VIBE/us_vibe](https://github.com/US-VIBE/us_vibe)를 올리고 **GitHub Actions**로 `develop` 푸시 시 자동 배포까지 연결하는 순서입니다.  
(무료 정책·한도는 [AWS Free Tier](https://aws.amazon.com/ko/free/)를 반드시 확인하세요. 12개월 이후·한도 초과 시 과금됩니다.)

---

## 1. AWS에 로그인

1. 브라우저에서 **https://console.aws.amazon.com** 접속  
2. **루트 계정** 또는 **IAM 사용자**로 로그인  
3. 상단 **리전**을 고릅니다. (예: **서울 `ap-northeast-2`**) 이후 모든 작업은 **같은 리전**에서 합니다.

---

## 2. 결제(Billing) 알람 켜기 (권장)

1. 콘솔 검색창에 **Billing** 입력 → **Billing and Cost Management**  
2. **Budgets** 또는 **Cost anomaly detection** / **알람** 중 사용하기 쉬운 것으로 **예산 초과 시 이메일**을 설정합니다.  
3. 무료 구간을 넘기면 과금되므로 **1 USD** 등 작은 예산으로도 알림을 걸어 두는 것을 권장합니다.

---

## 3. 키 페어 만들기 (.pem)

1. 콘솔 검색: **EC2** → **EC2** 대시보드로 이동  
2. 왼쪽 **네트워크 및 보안** → **키 페어**  
3. **키 페어 생성**  
   - 이름: 예) `us-vibe-deploy`  
   - 유형: **RSA**  
   - 형식: **`.pem`** (Mac/Linux/OpenSSH용 — Windows OpenSSH도 사용 가능)  
4. **키 페어 생성** 클릭 → **자동으로 `.pem` 파일이 다운로드**됩니다.  
5. 이 파일은 **다시 내려받을 수 없습니다.** 안전한 폴더에 보관합니다.

---

## 4. 보안 그룹 만들기 (SSH + 웹/API 포트)

1. EC2 왼쪽 **네트워크 및 보안** → **보안 그룹**  
2. **보안 그룹 생성**  
   - 이름: 예) `us-vibe-sg`  
   - VPC: **기본 VPC** 선택  
3. **인바운드 규칙**에 아래를 추가합니다.

| 유형        | 포트 범위 | 소스        | 설명        |
|-------------|-----------|-------------|-------------|
| SSH         | 22        | 내 IP / 0.0.0.0/0 | SSH 접속 (처음엔 **내 IP** 권장) |
| 사용자 지정 TCP | 3000  | 0.0.0.0/0   | Next 웹     |
| 사용자 지정 TCP | 4000  | 0.0.0.0/0   | Nest API    |

4. **아웃바운드**는 기본(전체 허용) 그대로 두어도 됩니다.  
5. 보안 그룹을 **생성**합니다.

---

## 5. EC2 인스턴스 시작 (Free Tier 가능한 타입)

1. EC2 → **인스턴스 시작**  
2. **이름**: 예) `us-vibe`  
3. **AMI**: **Ubuntu Server 22.04 LTS** (또는 24.04 LTS)  
4. **인스턴스 유형**: **`t3.micro`** 또는 **`t2.micro`**  
   - 계정에 따라 Free Tier에 포함되는 타입이 다를 수 있으므로, 화면에 **“무료 등급 사용 가능”** 표시가 있는지 확인합니다.  
5. **키 페어**: 위에서 만든 `.pem` 선택  
6. **네트워크 설정**  
   - **방화벽(보안 그룹)**: 위에서 만든 **`us-vibe-sg`** 선택  
7. **스토리지**: 기본 **8~30 GiB gp3** 등 기본값 사용 가능 (Free Tier gp2 한도 확인)  
8. **인스턴스 시작** 클릭  

---

## 6. 퍼블릭 IP 확인

1. EC2 → **인스턴스** → 방금 만든 인스턴스 선택  
2. 아래 세부 정보에서 **퍼블릭 IPv4 주소**를 확인합니다.  
   예: `3.34.12.34`  
3. 이 주소가 **`VPS_HOST`** 및 브라우저 접속 주소에 쓰입니다.

**참고:** 인스턴스를 **중지 후 다시 시작**하면 퍼블릭 IP가 **바뀔 수 있습니다.** 고정이 필요하면 **탄력적 IP(Elastic IP)**를 할당해 인스턴스에 연결합니다(무료 구간 정책 확인).

---

## 7. Windows에서 SSH 접속

1. PowerShell 또는 터미널을 엽니다.  
2. (한 번만) `.pem` 권한을 좁히는 것이 좋습니다.  
   `icacls "C:\Users\본인\Downloads\키이름.pem" /inheritance:r`  
   `icacls "C:\Users\본인\Downloads\키이름.pem" /grant:r "%USERNAME%:R"`  
3. 접속:

```powershell
ssh -i "C:\Users\본인\Downloads\키이름.pem" ubuntu@퍼블릭IPv4주소
```

- Ubuntu AMI의 기본 사용자는 **`ubuntu`** 입니다.  
4. `Are you sure you want to continue connecting` → **`yes`** 입력  

접속에 성공하면 프롬프트가 `ubuntu@ip-...:~$` 형태로 바뀝니다.

---

## 8. EC2에 Docker 설치

SSH 접속한 **서버 터미널**에서 순서대로 실행합니다.

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

로그아웃 후 다시 SSH 접속(또는 `newgrp docker`)한 뒤 확인:

```bash
docker --version
docker compose version
```

---

## 9. 저장소 클론 및 환경 파일

```bash
sudo mkdir -p /opt/us_vibe
sudo chown -R ubuntu:ubuntu /opt/us_vibe
cd /opt/us_vibe
git clone https://github.com/US-VIBE/us_vibe.git .
git checkout develop
cp deploy/env.deploy.example deploy/.env.deploy
nano deploy/.env.deploy
```

- **`NEXT_PUBLIC_API_BASE_URL`**: `http://퍼블릭IPv4:4000` 형태로 입력  
- **`DATABASE_URL`**: 기본 compose Postgres를 쓰면 예시 그대로 `postgres://postgres:postgres@postgres:5432/usvibe`  
저장 후 종료(`nano`는 `Ctrl+O`, Enter, `Ctrl+X`).

---

## 10. Docker로 기동

```bash
cd /opt/us_vibe
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.deploy up -d --build
docker compose -f deploy/docker-compose.prod.yml ps
```

브라우저에서 `http://퍼블릭IPv4:3000` 접속해 확인합니다.

**RAM 1GB(t2.micro 등)**에서는 빌드가 빡빡할 수 있습니다. 실패하면 인스턴스 타입을 올리거나, 스왑을 추가하는 방법을 검토합니다(이때부터는 Free Tier 밖일 수 있음).

---

## 11. GitHub Actions 자동 배포 연결

로컬 PC에서 **배포 전용 SSH 키**를 새로 만들어도 되고, 위 **EC2용 `.pem`을 GitHub Secret에 넣지 않는 것**이 더 안전합니다. 권장: **배포 전용 키 한 쌍**을 만들고 **공개키만** EC2 `ubuntu` 사용자의 `~/.ssh/authorized_keys`에 추가합니다.

**서버에서:**

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

로컬 PC에서 생성한 **공개키 한 줄**을 붙여 넣고 저장. `chmod 600 ~/.ssh/authorized_keys`

**GitHub 저장소** `US-VIBE/us_vibe` → **Settings** → **Secrets and variables** → **Actions**:

| Secret 이름    | 값 |
|----------------|-----|
| `VPS_HOST`     | EC2 **퍼블릭 IPv4** |
| `VPS_USER`     | `ubuntu` |
| `VPS_SSH_KEY`  | 배포용 **개인키 전체** (줄바꿈 포함) |

**Variables**:

| Variable 이름     | 값 예시 |
|-------------------|---------|
| `VPS_DEPLOY_PATH` | `/opt/us_vibe` |

이후 **`develop`에 push**하면 워크플로 `develop`이 **CI → SSH로 `git pull` + `docker compose`**를 실행합니다.  
워크플로 조건은 저장소가 **`US-VIBE/us_vibe`**일 때만 `deploy-vps`가 돌아가도록 되어 있습니다.

---

## 12. HTTPS (리버스 프록시 권장)

브라우저에서 **JWT·세션 쿠키**가 오가므로, 공인 서비스는 **HTTPS 종단**을 두는 것이 좋습니다.

1. **도메인**을 EC2 퍼블릭 IP에 **A 레코드**로 연결합니다.  
2. 아래 중 하나로 **TLS 종료**를 구성합니다.  
   - **Caddy** 또는 **nginx**를 같은 EC2에 두고, `localhost:3000`(웹)·`localhost:4000`(API)으로 **리버스 프록시**  
   - 또는 **AWS Application Load Balancer + ACM** 인증서로 TLS 종료 후 EC2로 전달  
3. `deploy/.env.deploy`의 **`NEXT_PUBLIC_API_BASE_URL`**, **`API_CORS_ORIGINS`**를 **`https://도메인`** 형태로 맞춥니다.  
4. GitHub 웹훅 URL도 **`https://.../webhooks/github`** 로 등록하고, **배달 IP 허용 목록**(`WEBHOOK_ALLOWLIST`)이 프록시 뒤 IP를 가리키면 안 되므로, **GitHub 공식 훅 IP 대역**([api.github.com/meta](https://api.github.com/meta)의 `hooks`)을 유지합니다.

자세한 프로덕션 환경 변수는 [docs/api/production-environment.md](../api/production-environment.md)를 참고하세요.

---

## 13. 정리

| 항목 | 값 |
|------|-----|
| SSH 사용자 | `ubuntu` |
| SSH 포트 | `22` (워크플로 기본값) |
| 배포 경로 | `/opt/us_vibe` (변수로 변경 가능) |
| 웹 | `http://퍼블릭IP:3000` |
| API | `http://퍼블릭IP:4000` |

DB 마이그레이션 등은 프로젝트 README의 DB 절차를 따릅니다.
