# Attendance & Leave Management System API

A comprehensive REST API for managing employee attendance and leave requests built with Node.js, Express.js, MongoDB, and Mongoose.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Attendance Management**: Check-in/check-out, break tracking, working hours calculation
- **Leave Management**: Apply, approve, reject leaves with balance tracking
- **Employee Management**: CRUD operations for employee records
- **Admin Dashboard**: Statistics, reports, and employee monitoring
- **Automatic Absent Marking**: Midnight cron job to mark employees as absent
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs, express-rate-limit
- **Scheduling**: node-cron
- **Validation**: express-validator

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system or use a cloud MongoDB service.

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/attendance_db` |
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/register` | Register new employee | Admin |
| POST | `/login` | Login user | Public |
| GET | `/me` | Get logged-in user profile | Private |
| PUT | `/change-password` | Change password | Private |

### Attendance (`/api/attendance`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/checkin` | Check-in for the day | Employee |
| POST | `/checkout` | Check-out for the day | Employee |
| POST | `/break/start` | Start a break | Employee |
| POST | `/break/end` | End a break | Employee |
| GET | `/today` | Get today's attendance | Employee |
| GET | `/history` | Get attendance history | Employee |
| GET | `/admin/all` | Get all attendance records | Admin |
| GET | `/admin/report` | Get attendance report | Admin |
| GET | `/admin/stats` | Get today's stats | Admin |

### Leave (`/api/leave`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/apply` | Apply for leave | Employee |
| GET | `/my` | Get my leave history | Employee |
| GET | `/balance` | Get my leave balance | Employee |
| PUT | `/cancel/:id` | Cancel pending leave | Employee |
| GET | `/admin/all` | Get all leave requests | Admin |
| PUT | `/admin/:id/approve` | Approve leave | Admin |
| PUT | `/admin/:id/reject` | Reject leave | Admin |
| GET | `/admin/balance/:userId` | Get employee balance | Admin |

### Employees (`/api/employees`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all employees | Admin |
| GET | `/:id` | Get single employee | Admin |
| PUT | `/:id` | Update employee | Admin |
| PUT | `/:id/deactivate` | Deactivate employee | Admin |
| GET | `/:id/attendance` | Get employee attendance | Admin |
| GET | `/:id/leaves` | Get employee leaves | Admin |

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": []
}
```

## Business Logic

### Attendance
- **Late Check-in**: Check-in after 9:30 AM → status = `late`
- **Half Day**: Working hours < 4 hours (240 min) → status = `half-day`
- **Working Hours**: (Check-out - Check-in) - Total break time
- **Automatic Absent**: Midnight cron job marks employees as absent if no check-in

### Leave
- **Working Days**: Only Monday-Friday counted between start and end dates
- **Leave Types**: Sick (10 days), Casual (12 days), Earned (15 days), Unpaid (unlimited)
- **Balance Deduction**: Auto-deduct on approval, restore on cancellation
- **Conflict Check**: Reject if overlapping leave already approved

## Default Login Credentials

After running the seed script:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@company.com` | `Admin@123` |
| Employee | `rahul@company.com` | `Emp@123` |
| Employee | `priya@company.com` | `Emp@123` |
| Employee | `arjun@company.com` | `Emp@123` |

## Folder Structure

```
/backend
  /config
    db.js              # Database connection
    jwt.js             # JWT helpers
  /controllers
    authController.js
    attendanceController.js
    leaveController.js
    employeeController.js
  /middleware
    authMiddleware.js
    isAdmin.js
    errorHandler.js
    notFound.js
    rateLimiter.js
  /models
    User.js
    Attendance.js
    Leave.js
    LeaveBalance.js
  /routes
    auth.js
    attendance.js
    leave.js
    employees.js
  /seed
    seed.js            # Demo data
  /utils
    attendanceHelpers.js
    leaveHelpers.js
  server.js
  .env
  package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with nodemon |
| `npm run seed` | Seed database with demo data |

## Security Features

- **Password Hashing**: bcryptjs with salt rounds 12
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Auth Rate Limiting**: 10 login attempts per 15 minutes
- **Input Validation**: express-validator for all inputs
- **CORS**: Cross-origin resource sharing enabled

## License

MIT

## Support

For issues and feature requests, please create an issue in the repository.
