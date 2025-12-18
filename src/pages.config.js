import Dashboard from './pages/Dashboard';
import SubmitDebtor from './pages/SubmitDebtor';
import DocumentEligibility from './pages/DocumentEligibility';
import BorderoManagement from './pages/BorderoManagement';


export const PAGES = {
    "Dashboard": Dashboard,
    "SubmitDebtor": SubmitDebtor,
    "DocumentEligibility": DocumentEligibility,
    "BorderoManagement": BorderoManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};