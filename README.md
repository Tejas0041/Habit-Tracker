# 🎯 Habit Tracker

A modern, full-stack habit tracking application built with the MERN stack. Track your daily habits, visualize your progress, and build better routines with beautiful charts and streak tracking.

![Habit Tracker](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

### 🔐 Authentication
- Secure Google OAuth 2.0 login
- JWT-based session management
- User profile management
- Account activation/deactivation by admin

### 💳 Subscription System
- **₹49/Year Subscription**: Affordable annual subscription model
- **Payment Screenshot Upload**: Users upload payment proof via Cloudinary
- **Image Compression**: Automatic compression to 150KB
- **Admin Verification**: Manual approval system for payments
- **Status Tracking**: Pending, Active, Expired subscription states
- **Access Control**: Non-subscribed users blocked from app features

### 🛡️ Admin Panel
- **Dashboard**: Overview of platform statistics with growth charts
- **User Management**: View, search, and manage all users
- **Subscription Management**: Approve/reject pending subscriptions
- **Activate/Deactivate Users**: Control user access
- **Delete Users**: Remove users and all their data
- **Dark/Light Theme**: Admin panel theme support
- **Access**: Navigate to `/admin` route
- **Credentials**: Set in `.env` file

### 📊 Habit Tracking
- **Daily Tracking**: Mark habits complete with a simple click
- **Monthly Goals**: Set custom goals for each habit
- **Streak Tracking**: Monitor current and longest streaks
- **Weekly Overview**: Visualize weekly performance with interactive charts
- **Progress Statistics**: Real-time completion rates and analytics

### 📈 Visualizations
- **Daily Progress Chart**: Line chart showing daily completion trends
- **Monthly Donut Chart**: Overall monthly progress visualization
- **Weekly Breakdown**: Color-coded weekly performance bars
- **Top 10 Habits**: Ranking of most completed habits

### 🎨 User Experience
- **Glassmorphism UI**: Modern, beautiful interface with blur effects
- **Dark Mode**: Easy on the eyes with full dark theme support
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Smooth Animations**: Polished transitions and interactions
- **IST Timezone**: All dates calculated in Indian Standard Time

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Google Cloud Console account

### 1. Google OAuth Setup

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Navigate to **Credentials** → **Create OAuth 2.0 Client ID**
5. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production URL (when deploying)
6. Copy the **Client ID**

### 2. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd habit-tracker

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

**Backend** - Create `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/habit-tracker
# Or use MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/habit-tracker

JWT_SECRET=your_super_secret_jwt_key_here_change_this

GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

CONTACT_EMAIL=healthtracker.tp@gmail.com

# Cloudinary Configuration (for payment screenshot uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

PORT=5000
```

**Frontend** - Create `frontend/.env`:
```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com

REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Run the Application

**Backend** (Terminal 1):
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm start
# App opens at http://localhost:3000
```

## 📁 Project Structure

```
habit-tracker/
├── backend/
│   ├── middleware/
│   │   └── auth.js           # JWT authentication middleware
│   ├── models/
│   │   ├── User.js           # User schema
│   │   ├── Habit.js          # Habit schema
│   │   ├── Tracking.js       # Daily tracking schema
│   │   └── MonthlyGoal.js    # Monthly goals schema
│   ├── routes/
│   │   ├── auth.js           # Authentication routes
│   │   ├── habits.js         # Habit CRUD routes
│   │   └── tracking.js       # Tracking & streak routes
│   ├── server.js             # Express server setup
│   ├── package.json
│   └── .env                  # Environment variables
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── api.js            # API client
│   │   ├── index.js          # React entry point
│   │   └── index.css         # Global styles
│   ├── package.json
│   └── .env                  # Environment variables
│
├── .gitignore
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **React** - UI library
- **Chart.js** & **react-chartjs-2** - Data visualization
- **@react-oauth/google** - Google authentication
- **CSS3** - Glassmorphism & animations

### Backend
- **Node.js** & **Express** - Server framework
- **MongoDB** & **Mongoose** - Database
- **JWT** - Token-based authentication
- **Google OAuth 2.0** - User authentication
- **Cloudinary** - Image storage for payment screenshots
- **Multer** - File upload handling
- **Sharp** - Image compression
- **CORS** - Cross-origin resource sharing

## 📱 Screenshots

### Desktop View
- Home page with hero section and features
- Habit tracker with daily checkboxes
- Weekly overview with interactive charts
- Statistics dashboard with progress tracking

### Mobile View
- Responsive design with hamburger menu
- Touch-optimized habit tracking
- Scrollable charts and tables
- Fixed navigation and month selector

## 🎨 Design Features

- **Glassmorphism**: Frosted glass effect with backdrop blur
- **Gradient Backgrounds**: Teal/emerald color scheme
- **Dark Mode**: Full dark theme support
- **Smooth Animations**: Fade-in, scale, and slide transitions
- **Custom Scrollbar**: Gradient-styled scrollbars
- **Responsive Layout**: Mobile-first design approach

## 🔒 Security

- JWT tokens for secure authentication
- HTTP-only cookies (optional implementation)
- Environment variables for sensitive data
- CORS configuration for API protection
- Google OAuth 2.0 for trusted authentication

## 📝 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Habits
- `GET /api/habits` - Get all habits for user
- `POST /api/habits` - Create new habit
- `PUT /api/habits/:id/goal` - Update monthly goal
- `DELETE /api/habits/:id` - Delete habit

### Tracking
- `GET /api/tracking/:year/:month` - Get month tracking data
- `POST /api/tracking/toggle` - Toggle habit completion
- `GET /api/tracking/streaks/:habitId/:year/:month` - Get habit streaks

### Subscription
- `POST /api/subscription/submit-payment` - Submit payment screenshot
- `GET /api/subscription/status` - Check subscription status

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/users` - Get all users with pagination
- `GET /api/admin/subscriptions/pending` - Get pending subscriptions
- `PUT /api/admin/subscriptions/:id/approve` - Approve subscription
- `PUT /api/admin/subscriptions/:id/reject` - Reject subscription
- `PUT /api/admin/users/:id/toggle-status` - Toggle user active status
- `DELETE /api/admin/users/:id` - Delete user

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 📧 Contact

For support or inquiries:
- Email: healthtracker.tp@gmail.com

## 👨‍💻 Author

**Tejas Pawar**
- Website: [tejaspawar.vercel.app](https://tejaspawar.vercel.app)

## 🙏 Acknowledgments

- Inspired by Excel-based habit trackers
- Chart.js for beautiful visualizations
- Google OAuth for secure authentication
- MongoDB for flexible data storage

---

Made with ❤️ by [Tejas Pawar](https://tejaspawar.vercel.app)
