# Smart Complaints Management System — Backend

Welcome to the backend of the **Smart Complaints Management System**, a university complaints management platform. This Node.js & Express application is powered by Sequelize ORM and is integrated with PostgreSQL (deployed on Supabase) as well as FastAPI-based Python AI services.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:
* **Node.js** (v16.x or higher)
* **npm** (v8.x or higher)
* **Postman** (to import the API collection)

---

## 📂 Project Structure

```text
backend/
├── config/
│   └── config.js            # Database configuration (Supabase PostgreSQL)
├── models/                  # Sequelize ORM models
├── migrations/              # Database migrations
├── seeders/                 # Database seed files
├── src/
│   ├── index.js             # Main server entrypoint
│   ├── Student/             # Student router, controllers, and validators
│   ├── Officer/             # Officer router, controllers, and services
│   ├── Manager/             # Manager router, controllers, and services
│   └── Admin/               # Admin router, controllers, and services
├── smart_complaints.postman_collection.json  # Pre-configured Postman Collection
└── package.json             # NPM dependencies & running scripts
```

---

## 🚀 How to Run the Project

### 1. Install Dependencies & Setup Database

A helper script `setup` is provided in `package.json` that installs dependencies, executes the database migrations, and seeds the database. Run the following command in the `backend` root directory:

```bash
npm run setup
```

*Alternatively, you can run the steps manually:*
```bash
# Install packages
npm install

# Run database migrations
npx sequelize-cli db:migrate

# Seed database with initial data
node seed.js
```

> [!NOTE]
> The application is pre-configured to connect to a secure **Supabase PostgreSQL** cloud instance out-of-the-box (defined in `config/config.js`), so you do not need to install or run PostgreSQL locally.

### 2. Start the Development Server

To start the server with auto-reload enabled (via `nodemon`), run:

```bash
npm run dev
```

The server will run on:
```text
🚀 http://localhost:3000
```

---

## 📬 Postman API Collection

A fully detailed Postman Collection is available in the root of the backend folder. It contains pre-configured payloads, variables, and path parameter setups.

### How to use:
1. Open **Postman**.
2. Click the **Import** button in the top-left corner.
3. Drag and drop the [smart_complaints.postman_collection.json](./smart_complaints.postman_collection.json) file.
4. The collection uses a local variable `baseUrl` which defaults to `http://localhost:3000`. Make sure the Express server is running when making requests.

---

## 📑 API Endpoint Documentation

Here is the complete list of available backend endpoints, divided by user roles.

### 1. Student Endpoints (`/api/complaints`)

Used by students to submit complaints, view their list of complaints, view a complaint's details, or file an appeal.

| HTTP Method | Route | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/complaints` | Submits a new student complaint | **Body (JSON):**<br>`user_id` (Integer, Required)<br>`category_id` (Integer, Required)<br>`problem` (String, Required)<br>`location` (String, Required)<br>`since` (Date/String, Required) |
| **GET** | `/api/complaints/student/:student_id` | Gets all complaints submitted by a student | **Path Variable:**<br>`student_id` (Integer) |
| **GET** | `/api/complaints/:id` | Gets details of a specific complaint | **Path Variable:**<br>`id` (Integer) |
| **POST** | `/api/complaints/:id/appeal` | Files a complaint appeal if the student is unsatisfied | **Path Variable:**<br>`id` (Integer)<br>**Body (JSON):**<br>`reason` (String, Required) |

---

### 2. Officer Endpoints (`/api/officer`)

Used by department/category officers to view and manage assigned complaints and review student appeals.

| HTTP Method | Route | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/officer/complaints` | Gets all complaints in the officer's department, ordered by AI priority | **Query Parameters:**<br>`category_id` (Integer, Required) |
| **GET** | `/api/officer/complaints/:id` | Gets detailed complaint information (includes student academic information) | **Path Variable:**<br>`id` (Integer) |
| **PATCH** | `/api/officer/complaints/:id/status` | Updates complaint status (to `in_progress` or `resolved`) | **Path Variable:**<br>`id` (Integer)<br>**Body (JSON):**<br>`status` (String, e.g. `'resolved'`) <br>`resolution_text` (String, Required if status is `'resolved'`) |
| **GET** | `/api/officer/appeals` | Gets pending appealed complaints in the officer's department | **Query Parameters:**<br>`category_id` (Integer, Required) |
| **PATCH** | `/api/officer/appeals/:id/review` | Marks a student's appeal as reviewed | **Path Variable:**<br>`id` (Integer) |

---

### 3. Manager Endpoints (`/api/manager`)

Used by administrators and university managers to inspect KPIs, department performances, heatmaps, and AI-suggested recommendations.

| HTTP Method | Route | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/manager/overview` | Gets overview statistics of all complaints | **Query Parameters:**<br>`from` (Date/String, Optional) |
| **GET** | `/api/manager/department-performance` | Gets details of resolution rates and average resolution times per department | None |
| **GET** | `/api/manager/heatmap` | Gets complaint distribution metrics | **Query Parameters:**<br>`dimension` (String, Required. Values: `category`, `location`, `time`, or `department`) |
| **GET** | `/api/manager/recommendations` | Lists AI-generated system recommendations | None |
| **PATCH** | `/api/manager/recommendations/:id` | Updates status of an AI recommendation | **Path Variable:**<br>`id` (Integer)<br>**Body (JSON):**<br>`status` (String, e.g., `'implemented'`, `'ignored'`, or `'pending'`) |
| **GET** | `/api/manager/reports` | Gets complaints filtered for report generation | **Query Parameters:**<br>`category_id` (Integer, Optional)<br>`status` (String, Optional)<br>`from` (Date, Optional)<br>`to` (Date, Optional) |
| **GET** | `/api/manager/top-issues/:category_id` | Gets top recurring issue keywords for a category | **Path Variable:**<br>`category_id` (Integer) |

---

### 4. Admin Endpoints (`/api/admin`)

Used to manage database configuration elements like users, categories, university regulations, and priority rules.

| HTTP Method | Route | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/categories` | Gets all categories | None |
| **POST** | `/api/admin/categories` | Adds a new complaint category | **Body (JSON):**<br>`name`, `description`, `sla_hours`, `keywords`, `responsible_id`, `faculty_id` |
| **PATCH** | `/api/admin/categories/:id` | Modifies an existing category | **Path Variable:**<br>`id`<br>**Body (JSON):** updated fields |
| **DELETE** | `/api/admin/categories/:id` | Soft deletes a category (`is_active` set to false) | **Path Variable:**<br>`id` |
| **GET** | `/api/admin/users` | Lists all users | None |
| **POST** | `/api/admin/users` | Creates a new user account | **Body (JSON):**<br>`full_name`, `email`, `password`, `role` |
| **PATCH** | `/api/admin/users/:id` | Modifies user details | **Path Variable:**<br>`id`<br>**Body (JSON):** updated fields |
| **DELETE** | `/api/admin/users/:id` | Soft deletes a user account | **Path Variable:**<br>`id` |
| **GET** | `/api/admin/regulations` | Gets all university rules/FAQ items | None |
| **POST** | `/api/admin/regulations` | Adds a new university rule or FAQ item | **Body (JSON):**<br>`article number` (String), `content` (String), `type` (String), `faculty_id` (Integer) |
| **DELETE** | `/api/admin/regulations/:id` | Permanently deletes a regulation item | **Path Variable:**<br>`id` |
| **GET** | `/api/admin/priority-rules` | Lists current system priority scoring rules | None |
| **POST** | `/api/admin/priority-rules` | Adds or updates a priority rule configuration | **Body (JSON):**<br>`priority level` (Integer), `description` (String), `examples` (Array/String) |
| **GET** | `/api/admin/audit-logs` | Retrieves log of admin edits to categories, regulations, and users | **Query Parameters:**<br>`user_id`, `entity_type`, `from`, `to` |
| **GET** | `/api/admin/insights` | Gets dashboard analytics widget statistics | None |

---

## 🤖 Connection with AI Services

The Node.js backend operates in coordination with the Python AI microservices. Certain actions in the backend automatically make API calls to the AI microservices:
1. **Adding a Category** calls `http://localhost:5000/api/refresh-categories` to sync category keywords.
2. **Adding a Regulation** calls `http://localhost:5000/api/regulations/refresh` to re-index documents in ChromaDB vector store.
3. **Submitting a Complaint** processes the complaint through the Groq chatbot to determine the priority level, categorize it, and ensure it isn't a duplicate.
