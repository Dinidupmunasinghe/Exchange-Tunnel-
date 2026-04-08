# EngageBoost - Facebook Engagement Exchange Platform

A modern SaaS web application for exchanging Facebook engagement (likes, comments, shares).

## 🎨 Design System

- **Theme**: Dark mode inspired by ChatGPT
- **Primary Color**: #10a37f (Soft teal/green)
- **Background**: #0f0f0f (Deep charcoal)
- **Font**: Inter (300, 400, 500, 600, 700)
- **Border Radius**: 12px (0.75rem)

## 📁 Project Structure

```
/src/app/
├── App.tsx                  # Main app entry with RouterProvider
├── routes.tsx              # React Router configuration
├── components/
│   ├── Layout.tsx          # Main layout with sidebar + topbar
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── TopBar.tsx          # Top navigation bar
│   ├── ChatWidget.tsx      # Floating chat button (Intercom-style)
│   ├── StatsCard.tsx       # Reusable stats card component
│   ├── LoadingState.tsx    # Loading spinner component
│   ├── EmptyState.tsx      # Empty state component
│   └── ui/                 # Shadcn UI components
└── pages/
    ├── Dashboard.tsx       # Main dashboard with stats & charts
    ├── EarnCredits.tsx     # Feed of posts to engage with
    ├── SubmitPost.tsx      # Create new campaigns
    ├── Campaigns.tsx       # Manage active/completed campaigns
    ├── Analytics.tsx       # Detailed analytics & insights
    ├── Wallet.tsx          # Credits management & transactions
    ├── Settings.tsx        # User settings (profile, notifications, etc.)
    └── NotFound.tsx        # 404 page
```

## 🚀 Features

### Dashboard
- Overview cards (credits, engagement, campaigns, activity)
- Engagement trends chart (7-day line chart)
- Credits overview chart (earned vs spent area chart)
- Recent activity feed

### Earn Credits
- Social media-style post feed
- Like, comment, share buttons with credit rewards
- Real-time credit earning with toast notifications
- Post images from Unsplash

### Submit Post
- Facebook post URL input
- Engagement type selection (likes/comments/shares/all)
- Credit budget slider
- Real-time campaign estimate
- Campaign summary sidebar

### Campaigns
- Active/completed/paused campaign cards
- Progress tracking with visual indicators
- Engagement statistics breakdown
- Campaign management (pause/resume/delete)

### Analytics
- Key metrics overview
- Tabbed interface (Overview, Campaigns, Credits)
- Multiple chart types (line, area, bar, pie)
- ROI tracking

### Wallet
- Credit balance display
- Buy credits packages
- Transaction history with filtering
- Earned vs spent tracking

### Settings
- Profile management
- Notification preferences
- Security settings
- Billing information
- Connected accounts

## 🎯 Key Technologies

- **React 18.3.1** - UI framework
- **React Router 7.13.0** - Navigation (Data mode)
- **Recharts 2.15.2** - Charts & data visualization
- **Lucide React** - Icon library
- **Tailwind CSS v4** - Styling
- **Sonner** - Toast notifications
- **Shadcn UI** - Component library

## 📱 Responsive Design

- **Desktop**: Full sidebar + top bar layout
- **Mobile**: Collapsible sidebar with hamburger menu
- **Tablet**: Optimized grid layouts

## 🎨 UI/UX Features

- Smooth transitions and hover effects
- Glassmorphism and soft shadows
- Skeleton loading states
- Toast notifications for user actions
- Empty states for no data
- Active state highlighting
- Color-coded engagement types
- Progress indicators
- Badge status indicators

## 🔧 Customization

All colors are defined in `/src/styles/theme.css` using CSS custom properties for easy theming.

## 📊 Mock Data

All pages use mock data for demonstration. In production, these would be replaced with API calls to a backend service.
