# FMS Testing

This repository contains test suites currently for **User Management** and **Application Services** of the FMS system.  


### 1. Clone the Repository
```bash
git clone https://github.com/govindTriz/FMS-test.git
```

### 2. Install Dependencies
Make sure you have Node.js installed, then run:
```
npm install
```

### 3. Configure Base URL
Update the baseURL in the .env to the IP address where your API Gateway is hosted.

```
BASE_URL=http://<API-GATEWAY-IP>:<PORT>
```

### 4. Running Tests

Run tests located in the FMS-Usermanagement service:
```
npx jest FMS-Usermanagement/tests --runInBand --verbose
```

Run tests located in the FMS-Application-services service:
```
npx jest FMS-Application-services/tests --runInBand --verbose
```

#### 📌 Notes<br>
Ensure your API Gateway is running and accessible at the configured baseURL.<br>
Use --runInBand to avoid parallel execution issues.