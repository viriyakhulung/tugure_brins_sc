import AuditLog from './pages/AuditLog';
import BorderoManagement from './pages/BorderoManagement';
import ClaimReview from './pages/ClaimReview';
import ClaimSubmit from './pages/ClaimSubmit';
import Dashboard from './pages/Dashboard';
import DocumentEligibility from './pages/DocumentEligibility';
import Home from './pages/Home';
import NotificationCenter from './pages/NotificationCenter';
import PaymentIntent from './pages/PaymentIntent';
import PaymentStatus from './pages/PaymentStatus';
import Profile from './pages/Profile';
import Reconciliation from './pages/Reconciliation';
import SubmitDebtor from './pages/SubmitDebtor';
import SystemConfiguration from './pages/SystemConfiguration';
import DebtorReview from './pages/DebtorReview';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditLog": AuditLog,
    "BorderoManagement": BorderoManagement,
    "ClaimReview": ClaimReview,
    "ClaimSubmit": ClaimSubmit,
    "Dashboard": Dashboard,
    "DocumentEligibility": DocumentEligibility,
    "Home": Home,
    "NotificationCenter": NotificationCenter,
    "PaymentIntent": PaymentIntent,
    "PaymentStatus": PaymentStatus,
    "Profile": Profile,
    "Reconciliation": Reconciliation,
    "SubmitDebtor": SubmitDebtor,
    "SystemConfiguration": SystemConfiguration,
    "DebtorReview": DebtorReview,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};