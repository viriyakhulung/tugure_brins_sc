import Dashboard from './pages/Dashboard';
import SubmitDebtor from './pages/SubmitDebtor';
import DocumentEligibility from './pages/DocumentEligibility';
import BorderoManagement from './pages/BorderoManagement';
import PaymentIntent from './pages/PaymentIntent';
import Reconciliation from './pages/Reconciliation';
import ClaimSubmit from './pages/ClaimSubmit';
import ClaimReview from './pages/ClaimReview';
import NotificationCenter from './pages/NotificationCenter';
import Profile from './pages/Profile';
import AuditLog from './pages/AuditLog';
import SystemConfiguration from './pages/SystemConfiguration';


export const PAGES = {
    "Dashboard": Dashboard,
    "SubmitDebtor": SubmitDebtor,
    "DocumentEligibility": DocumentEligibility,
    "BorderoManagement": BorderoManagement,
    "PaymentIntent": PaymentIntent,
    "Reconciliation": Reconciliation,
    "ClaimSubmit": ClaimSubmit,
    "ClaimReview": ClaimReview,
    "NotificationCenter": NotificationCenter,
    "Profile": Profile,
    "AuditLog": AuditLog,
    "SystemConfiguration": SystemConfiguration,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};