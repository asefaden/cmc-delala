# Kubernetes Deployment — CMC Delala

This directory contains Kubernetes manifests for deploying the CMC Delala application.

## Architecture

The app runs as a **single container** that serves both:
- **Backend API** (`/api/*`) — Express.js on port 3000
- **Frontend SPA** — Built React app served as static files

```
Internet → Ingress → Service (ClusterIP:3000) → Pod (node server.js :3000)
```

## Files

| File | Description |
|------|-------------|
| `deployment.yaml` | Pod/Deployment with liveness/readiness probes |
| `service.yaml` | ClusterIP Service mapping port 3000 → targetPort 3000 |
| `ingress.yaml` | Ingress routing `/api`, `/uploads`, and all other paths |
| `secret.yaml` | Template for database credentials and JWT_SECRET |
| `pvc.yaml` | PersistentVolumeClaim for user uploads |

---

## Quick Start

### 1. Create the Secret (REQUIRED)

**Never use the template directly in production.** Create a real secret:

```bash
kubectl create secret generic cmc-delal-secrets \
  --from-literal=jwt-secret=$(openssl rand -hex 64) \
  --from-literal=db-host=YOUR_DB_HOST \
  --from-literal=db-name=delala \
  --from-literal=db-user=YOUR_DB_USER \
  --from-literal=db-password=YOUR_DB_PASSWORD
```

### 2. Edit the Ingress

Replace `your-domain.com` in `ingress.yaml` with your actual domain:

```bash
sed -i 's/your-domain.com/YOUR_ACTUAL_DOMAIN/g' k8s/ingress.yaml
```

### 3. Update the Docker Image

Replace the image path in `deployment.yaml` with your actual registry:

```bash
# Example for GitHub Container Registry:
# ghcr.io/asefaden/cmc-delala:latest
#
# Example for Docker Hub:
# aletf/cmc-delala:latest
```

### 4. Apply All Manifests

```bash
kubectl apply -f k8s/
```

Or apply in order:

```bash
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Fixing the 502 Bad Gateway

The 502 error occurs when the Ingress cannot reach the backend Pod. Here's a systematic checklist:

### Step 1: Verify Pod is Running

```bash
kubectl get pods -l app=cmc-delal-backend
```

Expected: Status `Running`, not `CrashLoopBackOff` or `Error`.

### Step 2: Check Pod Logs

```bash
kubectl logs -l app=cmc-delal-backend --tail=50
```

Expected: You should see:
```
✓ Running
✓ Database: Connected & schema ready
```

### Step 3: Verify Service Has Endpoints

```bash
kubectl get endpoints cmc-delal-backend
```

Expected: Shows pod IP(s) and port 3000, NOT `<none>`.

If endpoints are empty, the **Service selector doesn't match the Pod labels**.
The Service and Deployment both use `app: cmc-delal-backend` — verify this matches.

### Step 4: Test from Inside the Cluster

```bash
# Port-forward the service to your local machine
kubectl port-forward svc/cmc-delal-backend 3000:3000

# In another terminal, test
curl http://localhost:3000/health
curl http://localhost:3000/api/auth
```

If this works, the backend is fine — the issue is **Ingress routing**.

### Step 5: Verify Ingress Rules

```bash
kubectl describe ingress cmc-delal-ingress
```

Check:
- `Rules` section shows the correct host and paths
- `Backend` points to `cmc-delal-backend:3000`
- No errors in `Events` section

### Step 6: Check Ingress Controller Logs

```bash
# For NGINX Ingress Controller
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
```

Look for 502 errors and upstream connection failures.

---

## Common Causes of 502

| Cause | Symptom | Fix |
|-------|---------|-----|
| **Service selector mismatch** | `kubectl get endpoints` shows `<none>` | Ensure `spec.selector.app` matches pod `metadata.labels.app` |
| **Port mismatch** | Ingress targets wrong port | Ensure Service `port` and `targetPort` are both `3000` |
| **Pod crash loop** | `kubectl get pods` shows `CrashLoopBackOff` | Check logs with `kubectl logs` |
| **Ingress routes to wrong service** | 502 only on `/api` paths | Verify ingress `backend.service.name` is `cmc-delal-backend` |
| **Ingress controller not installed** | No ingress controller pods | Install NGINX Ingress Controller |
| **Missing health check** | Pod killed by readiness probe | Ensure `/health` endpoint responds on port 3000 |

---

## Enabling TLS

1. Install [cert-manager](https://cert-manager.io/docs/installation/)
2. Uncomment the `cert-manager.io/cluster-issuer` annotation in `ingress.yaml`
3. Uncomment the `tls` section and set your domain

---

## Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment cmc-delal-backend --replicas=3
```

---

## Updating

```bash
# Pull the new image and restart
kubectl rollout restart deployment/cmc-delal-backend

# Watch the rollout
kubectl rollout status deployment/cmc-delal-backend
```

---

## Debugging Commands

```bash
# Full status overview
kubectl get all -l app=cmc-delal-backend

# Describe deployment for events
kubectl describe deployment cmc-delal-backend

# Describe service
kubectl describe service cmc-delal-backend

# Describe ingress
kubectl describe ingress cmc-delal-ingress

# Check secrets exist
kubectl get secret cmc-delal-secrets

# Pod shell access (for debugging)
kubectl exec -it deploy/cmc-delal-backend -- sh