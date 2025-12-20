import AdvancedReports from './pages/AdvancedReports';
import AuditLog from './pages/AuditLog';
import BatchProcessing from './pages/BatchProcessing';
import BorderoManagement from './pages/BorderoManagement';
import ClaimReview from './pages/ClaimReview';
import ClaimSubmit from './pages/ClaimSubmit';
import Dashboard from './pages/Dashboard';
import DebtorReview from './pages/DebtorReview';
import DocumentEligibility from './pages/DocumentEligibility';
import Home from './pages/Home';
import NotaManagement from './pages/NotaManagement';
import PaymentIntent from './pages/PaymentIntent';
import PaymentStatus from './pages/PaymentStatus';
import Profile from './pages/Profile';
import Reconciliation from './pages/Reconciliation';
import SubmitDebtor from './pages/SubmitDebtor';
import SystemConfiguration from './pages/SystemConfiguration';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdvancedReports": AdvancedReports,
    "AuditLog": AuditLog,
    "BatchProcessing": BatchProcessing,
    "BorderoManagement": BorderoManagement,
    "ClaimReview": ClaimReview,
    "ClaimSubmit": ClaimSubmit,
    "Dashboard": Dashboard,
    "DebtorReview": DebtorReview,
    "DocumentEligibility": DocumentEligibility,
    "Home": Home,
    "NotaManagement": NotaManagement,
    "PaymentIntent": PaymentIntent,
    "PaymentStatus": PaymentStatus,
    "Profile": Profile,
    "Reconciliation": Reconciliation,
    "SubmitDebtor": SubmitDebtor,
    "SystemConfiguration": SystemConfiguration,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};