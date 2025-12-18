import AuditLog from './pages/AuditLog';
import BorderoManagement from './pages/BorderoManagement';
import ClaimReview from './pages/ClaimReview';
import ClaimSubmit from './pages/ClaimSubmit';
import Dashboard from './pages/Dashboard';
import DocumentEligibility from './pages/DocumentEligibility';
import NotificationCenter from './pages/NotificationCenter';
import PaymentIntent from './pages/PaymentIntent';
import PaymentStatus from './pages/PaymentStatus';
import Profile from './pages/Profile';
import Reconciliation from './pages/Reconciliation';
import SubmitDebtor from './pages/SubmitDebtor';
import SystemConfiguration from './pages/SystemConfiguration';
import Home from './pages/Home';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditLog": AuditLog,
    "BorderoManagement": BorderoManagement,
    "ClaimReview": ClaimReview,
    "ClaimSubmit": ClaimSubmit,
    "Dashboard": Dashboard,
    "DocumentEligibility": DocumentEligibility,
    "NotificationCenter": NotificationCenter,
    "PaymentIntent": PaymentIntent,
    "PaymentStatus": PaymentStatus,
    "Profile": Profile,
    "Reconciliation": Reconciliation,
    "SubmitDebtor": SubmitDebtor,
    "SystemConfiguration": SystemConfiguration,
    "Home": Home,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};