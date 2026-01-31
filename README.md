# DevSecOps Hands-On Lab Guide

A complete step-by-step guide for students to replicate the full DevSecOps pipeline using GitHub, GitHub Actions (Self-Hosted Runner), Docker, GHCR Registry, Semantic Versioning, Kubernetes (Minikube), and CI/CD.

---

## **1. VM SETUP (Ubuntu 22.04 Recommended)**

### **1.1 Update System**

```
sudo apt update && sudo apt upgrade -y
```

### **1.2 Install Required Tools**

```
sudo apt install -y docker.io docker-compose git curl wget
```

Enable and start Docker:

```
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"
```

(Reboot after this step.)

### **1.3 Install kubectl**

```
curl -LO https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### **1.4 Install Minikube**

```
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

### **1.5 Start Minikube (Docker Driver)**

```
minikube start --driver=docker
```

### **1.6 Verify Cluster**

```
kubectl get nodes
```

---

## **2. GitHub SETUP**

### **2.1 Create a New GitHub Repository**

Example name:

```
devsecops-workshop
```

Clone it:

```
git clone https://github.com/<username>/devsecops-workshop.git
cd devsecops-workshop
```

---

## **3. CREATE DOCKERFILE + APP**

Directory structure:

```
app/
  Dockerfile
  index.js
k8s/
  deployment.yaml
  service.yaml
```

### **3.1 Sample Dockerfile (Node.js)**

```
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### **3.2 Sample index.js**

```
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('DevSecOps Workshop Working!'));
app.listen(3000, () => console.log('Running on port 3000'));
```

---

## **4. PUSH CODE TO GITHUB**

```
git add .
git commit -m "Initial commit"
git push origin main
```

---

## **5. SETUP GITHUB CONTAINER REGISTRY (GHCR)**

### **5.1 Generate a GitHub PAT**

Permissions:

* `read:packages`
* `write:packages`
* `delete:packages`
* `repo`

Save as GitHub Secret:

```
GHCR_PAT
```

---

## **6. SELF-HOSTED RUNNER SETUP**

### **6.1 In GitHub → Repository → Settings → Actions → Runners**

Add → New self-hosted runner → Linux

Follow commands provided:

```
mkdir actions-runner && cd actions-runner
curl -o actions-runner.tar.gz -L <github_link>
tar xzf actions-runner.tar.gz
```

### **6.2 Configure runner**

```
./config.sh --url https://github.com/<username>/<repo> --token <token>
```

### **6.3 Start runner**

```
./run.sh
```

(Keep terminal open.)

---

## **7. KUBERNETES DEPLOYMENT FILES**

### **7.1 deployment.yaml**

```
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devsecops-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: devsecops-app
  template:
    metadata:
      labels:
        app: devsecops-app
    spec:
      containers:
      - name: web
        image: ghcr.io/<user>/devsecops-app:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
      imagePullSecrets:
      - name: ghcr-secret
```

### **7.2 service.yaml**

```
apiVersion: v1
kind: Service
metadata:
  name: devsecops-svc
spec:
  selector:
    app: devsecops-app
  ports:
  - port: 3000
    targetPort: 3000
  type: NodePort
```

---

## **8. CI/CD PIPELINE (GITHUB ACTIONS)**

Path: `.github/workflows/cicd.yaml`

```
name: DevSecOps CI/CD

on:
  push:
    branches: [ main ]

jobs:
  pipeline:
    runs-on: self-hosted

    steps:
    - uses: actions/checkout@v4

    - name: Generate Semantic Version
      id: version
      uses: paulhatch/semantic-version@v5.4.0
      with:
        tag_prefix: "v"
        format: "${major}.${minor}.${patch}"
        major_pattern: "BREAKING CHANGE"
        minor_pattern: "feat"

    - name: Print version
      run: echo "VERSION=${{ steps.version.outputs.version }}"

    - name: Build Docker Image
      run: |
        VERSION=${{ steps.version.outputs.version }}
        docker build --no-cache \
          -t ghcr.io/${{ github.repository_owner }}/devsecops-app:$VERSION \
          -t ghcr.io/${{ github.repository_owner }}/devsecops-app:latest \
          -f app/Dockerfile app/

    - name: Scan Image with Trivy
      uses: aquasecurity/trivy-action@0.20.0
      with:
        image-ref: ghcr.io/${{ github.repository_owner }}/devsecops-app:latest
        severity: CRITICAL,HIGH
        ignore-unfixed: true
        exit-code: "0"

    - name: Login to GHCR
      run: echo "${{ secrets.GHCR_PAT }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

    - name: Push Images
      run: |
        VERSION=${{ steps.version.outputs.version }}
        docker push ghcr.io/${{ github.repository_owner }}/devsecops-app:$VERSION
        docker push ghcr.io/${{ github.repository_owner }}/devsecops-app:latest

    - name: Create GHCR Secret
      run: |
        kubectl delete secret ghcr-secret --ignore-not-found=true
        kubectl create secret docker-registry ghcr-secret \
          --docker-server=ghcr.io \
          --docker-username=${{ github.actor }} \
          --docker-password=${{ secrets.GHCR_PAT }} \
          --docker-email=dummy@example.com

    - name: Apply Manifests
      run: kubectl apply -f k8s/

    - name: Patch Deployment With Version
      run: |
        VERSION=${{ steps.version.outputs.version }}
        kubectl set image deployment/devsecops-app web=ghcr.io/${{ github.repository_owner }}/devsecops-app:$VERSION

    - name: Wait for Rollout
      run: kubectl rollout status deployment/devsecops-app
```

---

## **9. ACCESS THE APP**

Get URL:

```
minikube service devsecops-svc --url
```

Open the URL in a browser.

---

## **10. OPTIONAL: PORT-FORWARD**

```
kubectl port-forward svc/devsecops-svc 3000:3000
```

Visit:

```
http://localhost:3000
```

---

## **11. CLEANUP COMMANDS**

```
kubectl delete deployment devsecops-app
kubectl delete svc devsecops-svc
minikube delete
```

---

If you want, I can also add:
✔ A troubleshooting section
✔ Architecture diagram
✔ Student exercise tasks
✔ Quiz and assessment rubric

Just tell me and I will add it!

## Publishing Images to Public Container Registries

### **A. Push Image to GitHub Container Registry (GHCR)**

#### **1. Generate a Personal Access Token (PAT)**

1. Go to **GitHub → Settings → Developer Settings → Personal Access Tokens → Classic**
2. Create a new token with these permissions:

   * `write:packages`
   * `read:packages`
3. Copy the token.

#### **2. Login to GHCR (from your VM)**

```bash
echo "<YOUR_GITHUB_PAT>" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

Test:

```bash
docker login ghcr.io
```

#### **3. Build your image locally**

Inside the folder containing your Dockerfile:

```bash
docker build -t ghcr.io/<username>/<repo-name>:latest .
```

Example:

```bash
docker build -t ghcr.io/faisalumer/devsecops-workshop:latest .
```

#### **4. Push the image**

```bash
docker push ghcr.io/<username>/<repo-name>:latest
```

Example:

```bash
docker push ghcr.io/faisalumer/devsecops-workshop:latest
```

#### **5. Make the image public**

GitHub → Profile → Packages → Select your package → **Settings** → Change visibility → **Public**

Verify:

```bash
docker pull ghcr.io/<username>/<repo-name>:latest
```

---

### **B. Push Image to Docker Hub (Alternative Option)**

#### **1. Login to Docker Hub**

```bash
docker login -u <dockerhub_username>
```

#### **2. Build Image**

```bash
docker build -t <dockerhub_username>/<repo-name>:latest .
```

Example:

```bash
docker build -t faisalumer/devsecops-workshop:latest .
```

#### **3. Push Image**

```bash
docker push <dockerhub_username>/<repo-name>:latest
```

#### **4. Make Public**

Docker Hub → Repository → Settings → Visibility → **Public**

Verify:

```bash
docker pull <dockerhub_username>/<repo-name>:latest
```

---

## SSH Key Generation & Adding Keys to GitHub

### **1. Generate SSH Keys on your VM**

Run:

```bash
ssh-keygen -t ed25519 -C "<your_email@example.com>"
```

Press **Enter** for default location:

```
/home/<user>/.ssh/id_ed25519
```

Set a passphrase (recommended) or leave empty.

### **2. Start SSH Agent & Add Key**

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### **3. Copy Public Key**

```bash
cat ~/.ssh/id_ed25519.pub
```

### **4. Add SSH Key to GitHub**

GitHub → **Settings** → **SSH and GPG Keys** → **New SSH Key**
Paste the public key.

### **5. Test SSH Access**

```bash
ssh -T git@github.com
```

You should see:

```
Hi <username>! You've successfully authenticated...
```

SSH is now fully configured and Git operations can use SSH instead of HTTPS.
