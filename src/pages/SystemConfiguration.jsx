import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, Bell, Mail, MessageSquare, Shield, DollarSign, 
  CheckCircle2, RefreshCw, Loader2, Plus, Edit, Trash2, Eye, User
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';

export default function SystemConfiguration() {
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState([]);
  const [selectedSettings, setSelectedSettings] = useState([]);
  const [systemConfigs, setSystemConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showSettingDialog, setShowSettingDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // User notification setting
  const [currentSetting, setCurrentSetting] = useState({
    notification_email: '',
    whatsapp_number: '',
    email_enabled: true,
    whatsapp_enabled: false,
    notify_batch_status: true,
    notify_record_status: true,
    notify_nota_status: true,
    notify_claim_status: true,
    notify_subrogation_status: true,
    notify_payment_received: true,
    notify_approval_required: true,
    notify_document_verification: true
  });

  // Config form
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const [configData, notifData, settingsData, templates] = await Promise.all([
        base44.entities.SystemConfig.list(),
        base44.entities.Notification.list(),
        base44.entities.NotificationSetting.list(),
        base44.entities.EmailTemplate.list()
      ]);
      
      // Create sample data if any is empty
      const needsSampleData = !configData || configData.length === 0 || 
                              !notifData || notifData.length === 0 ||
                              !templates || templates.length === 0;
      
      if (needsSampleData) {
        await createSampleConfigs();
        // Reload all data after creating samples
        const [newConfigData, newNotifData, newTemplateData] = await Promise.all([
          base44.entities.SystemConfig.list(),
          base44.entities.Notification.list(),
          base44.entities.EmailTemplate.list()
        ]);
        setSystemConfigs(newConfigData || []);
        setNotifications(newNotifData || []);
        setEmailTemplates(newTemplateData || []);
      } else {
        setSystemConfigs(configData || []);
        setNotifications(notifData || []);
        setEmailTemplates(templates || []);
      }
      
      setNotificationSettings(settingsData || []);
      
      const userSetting = settingsData.find(s => s.user_email === currentUser.email);
      if (userSetting) {
        setCurrentSetting(userSetting);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const createSampleConfigs = async () => {
    const sampleConfigs = [
      // Eligibility Rules
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_LOAN_TENURE_MONTHS', config_value: '120', description: 'Maximum loan tenure allowed for coverage (months)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MIN_LOAN_AMOUNT_IDR', config_value: '10000000', description: 'Minimum loan amount eligible for coverage (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_DEBTOR_AGE', config_value: '65', description: 'Maximum age of debtor at time of application', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'KOLEKTIBILITAS_THRESHOLD', config_value: '2', description: 'Maximum collectibility level allowed (0=Normal, 1=DPK, 2=KL)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_INDIVIDUAL', config_value: '4', description: 'Number of required documents for Individual credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_CORPORATE', config_value: '6', description: 'Number of required documents for Corporate credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Financial Thresholds
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'COVERAGE_PERCENTAGE', config_value: '70', description: 'Default coverage percentage for reinsurance', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_INDIVIDUAL', config_value: '0.85', description: 'Premium rate for individual credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_CORPORATE', config_value: '0.65', description: 'Premium rate for corporate credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'MAX_CLAIM_AMOUNT_IDR', config_value: '5000000000', description: 'Maximum claimable amount per debtor (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'LATE_PAYMENT_PENALTY_RATE', config_value: '0.5', description: 'Late payment penalty rate per month (%)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PAYMENT_GRACE_PERIOD_DAYS', config_value: '30', description: 'Grace period before late payment penalty applies', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Approval Matrix
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_AUTO_APPROVE_LIMIT', config_value: '100000000', description: 'Auto-approve debtors with exposure below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_AUTO_APPROVE_LIMIT', config_value: '50000000', description: 'Auto-approve claims below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'REQUIRES_SENIOR_APPROVAL', config_value: '500000000', description: 'Amount requiring senior management approval (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_REVIEW_SLA_HOURS', config_value: '48', description: 'SLA for debtor review and approval (hours)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_REVIEW_SLA_DAYS', config_value: '14', description: 'SLA for claim review and decision (days)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' }
    ];

    for (const config of sampleConfigs) {
      try {
        await base44.entities.SystemConfig.create(config);
      } catch (error) {
        console.error('Failed to create sample config:', error);
      }
    }
    
    // Create sample notifications - Complete workflow coverage
    const sampleNotifications = [
      // Batch Workflow
      {
        title: '[Batch] Status Updated: Uploaded → Validated',
        message: 'Batch BATCH-2025-001 has been validated by tugure@company.com. Total 45 records validated. Email notification sent to brins@company.com with validation details.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Validated → Matched',
        message: 'Batch BATCH-2025-001 has been matched by system. 45 records matched successfully. Matching process completed. Email notification sent to both parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      {
        title: '[Batch] Status Updated: Matched → Approved',
        message: 'Batch BATCH-2025-001 with total premium IDR 125,000,000 has been approved by tugure@company.com. Ready for Nota issuance. Auto email sent to BRINS.',
        type: 'DECISION',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Approved → Nota Issued',
        message: 'Batch BATCH-2025-001 - Nota has been issued. Nota number: NOTA-2025-001. Total amount: IDR 125,000,000. Email sent to brins@company.com for branch confirmation.',
        type: 'ACTION_REQUIRED',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Batch] Status Updated: Nota Issued → Branch Confirmed',
        message: 'Batch BATCH-2025-001 - Branch has confirmed Nota NOTA-2025-001. Waiting for payment. Email notification sent to tugure@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Batch] Status Updated: Branch Confirmed → Paid',
        message: 'Batch BATCH-2025-001 - Payment received for Nota NOTA-2025-001. Amount: IDR 125,000,000. Payment date: 2025-01-15. Email sent to both parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      {
        title: '[Batch] Status Updated: Paid → Closed',
        message: 'Batch BATCH-2025-001 has been closed successfully. All processes completed. Final reconciliation done. Email sent to all stakeholders.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Record Workflow
      {
        title: '[Record] Status Updated: Accepted → Revised',
        message: 'Record REC-2025-001 in Batch BATCH-2025-002 marked as Revised. Reason: Incomplete documentation. Please resubmit corrected data. Email sent to brins@company.com.',
        type: 'WARNING',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Record] Status Updated: Revised → Accepted',
        message: 'Record REC-2025-001 has been re-validated and accepted. Corrections verified successfully. Email sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Record] Status Updated: Accepted → Rejected',
        message: 'Record REC-2025-003 has been rejected permanently. Reason: Non-eligible debtor - exceeds age limit. Email sent to brins@company.com with rejection details.',
        type: 'WARNING',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      
      // Nota Workflow
      {
        title: '[Nota] Status Updated: Draft → Issued',
        message: 'Nota NOTA-2025-002 has been issued for Batch BATCH-2025-002. Total amount: IDR 85,500,000. Issued date: 2025-01-10. Email sent to brins@company.com.',
        type: 'ACTION_REQUIRED',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Nota] Status Updated: Issued → Confirmed',
        message: 'Nota NOTA-2025-002 has been confirmed by Branch on 2025-01-12. Confirmed by: branch_manager@brins.com. Email notification sent to tugure@company.com for payment processing.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Nota] Status Updated: Confirmed → Paid',
        message: 'Nota NOTA-2025-002 payment completed. Amount paid: IDR 85,500,000. Payment reference: PAY-2025-002. Email sent to all parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Claim Workflow
      {
        title: '[Claim] Status Updated: Draft → Checked',
        message: 'Claim CLM-2025-001 for debtor PT ABC has been checked and eligibility verified. Claim amount: IDR 50,000,000. Email notification sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Claim] Status Updated: Checked → Doc Verified',
        message: 'Claim CLM-2025-001 - All supporting documents verified successfully. Next step: invoicing. Verified by: claim_officer@tugure.com. Email sent to finance team.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'TUGURE'
      },
      {
        title: '[Claim] Status Updated: Doc Verified → Invoiced',
        message: 'Claim CLM-2025-001 has been invoiced. Invoice number: INV-CLM-2025-001. Amount: IDR 50,000,000. Email sent to brins@company.com.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Claim] Status Updated: Invoiced → Paid',
        message: 'Claim CLM-2025-001 payment completed. Settlement amount: IDR 50,000,000. Settlement date: 2025-01-20. Email sent to all parties.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      
      // Subrogation Workflow
      {
        title: '[Subrogation] Status Updated: Draft → Invoiced',
        message: 'Subrogation SUB-2025-001 for Claim CLM-2025-001 has been invoiced. Recovery amount: IDR 25,000,000. Invoice sent. Email sent to BRINS.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: '[Subrogation] Status Updated: Invoiced → Paid / Closed',
        message: 'Subrogation SUB-2025-001 completed and closed. Recovery received: IDR 25,000,000. Final settlement done. Email sent to all stakeholders.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      }
    ];
    
    for (const notif of sampleNotifications) {
      try {
        await base44.entities.Notification.create(notif);
      } catch (error) {
        console.error('Failed to create sample notification:', error);
      }
    }
    
    // Create sample email templates - Complete end-to-end workflow
    const sampleTemplates = [
      // === BATCH WORKFLOW ===
      {
        object_type: 'Batch',
        status_from: 'Uploaded',
        status_to: 'Validated',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Validated Successfully',
        email_body: 'Dear BRINS Team,\n\nYour batch {batch_id} has been validated successfully by {user_name} on {date}.\n\nValidation Summary:\n- Total Records: {total_records}\n- Total Exposure: {total_exposure}\n- Total Premium: {total_premium}\n\nNext Step: System will proceed with matching process.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Validated',
        status_to: 'Matched',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Matching Completed',
        email_body: 'Dear Team,\n\nBatch {batch_id} matching process completed on {date}.\n\nMatching Results:\n- Records Matched: {total_records}\n- Total Premium Matched: {total_premium}\n\nNext Step: Approval review by TUGURE team.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Matched',
        status_to: 'Approved',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Approved for Coverage',
        email_body: 'Dear BRINS Team,\n\nBatch {batch_id} has been approved by {user_name}.\n\nApproval Details:\n- Approval Date: {date}\n- Total Exposure: {total_exposure}\n- Total Premium: {total_premium}\n- Approved Records: {total_records}\n\nNext Step: Nota will be issued within 24 hours.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Approved',
        status_to: 'Nota Issued',
        recipient_role: 'BRINS',
        email_subject: '[Batch {batch_id}] Nota Issued - Action Required',
        email_body: 'Dear BRINS Team,\n\nNota has been issued for Batch {batch_id}.\n\nNota Details:\n- Nota Number: {nota_number}\n- Issue Date: {date}\n- Total Amount: {total_premium}\n\nAction Required: Please confirm receipt at your branch within 3 business days.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Nota Issued',
        status_to: 'Branch Confirmed',
        recipient_role: 'TUGURE',
        email_subject: '[Batch {batch_id}] Branch Confirmation Received',
        email_body: 'Dear TUGURE Team,\n\nBranch has confirmed receipt of Nota for Batch {batch_id}.\n\nConfirmation Details:\n- Confirmed by: {user_name}\n- Confirmation Date: {date}\n- Nota Amount: {total_premium}\n\nNext Step: Please proceed with payment processing.\n\nBest regards,\nBRINS System',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Branch Confirmed',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Payment Received',
        email_body: 'Dear Team,\n\nPayment received for Batch {batch_id}.\n\nPayment Details:\n- Payment Date: {date}\n- Amount Paid: {total_premium}\n- Payment Reference: {payment_reference}\n\nNext Step: Batch will be closed after final reconciliation.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Batch',
        status_from: 'Paid',
        status_to: 'Closed',
        recipient_role: 'ALL',
        email_subject: '[Batch {batch_id}] Batch Closed Successfully',
        email_body: 'Dear Team,\n\nBatch {batch_id} has been closed successfully.\n\nFinal Summary:\n- Total Records: {total_records}\n- Total Exposure: {total_exposure}\n- Total Premium: {total_premium}\n- Closed Date: {date}\n\nAll processes completed. Batch is now archived.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === RECORD WORKFLOW ===
      {
        object_type: 'Record',
        status_from: 'Accepted',
        status_to: 'Revised',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Revision Required',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} in Batch {batch_id} requires revision.\n\nRevision Details:\n- Reason: {revision_reason}\n- Revised Date: {date}\n- Reviewed by: {user_name}\n\nAction Required: Please submit corrected information within 5 business days.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Record',
        status_from: 'Revised',
        status_to: 'Accepted',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Re-validation Accepted',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} has been re-validated and accepted.\n\nAcceptance Details:\n- Re-validation Date: {date}\n- Validated by: {user_name}\n- Batch: {batch_id}\n\nRecord is now included in the active batch.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Record',
        status_from: 'Accepted',
        status_to: 'Rejected',
        recipient_role: 'BRINS',
        email_subject: '[Record {record_id}] Record Rejected',
        email_body: 'Dear BRINS Team,\n\nRecord {record_id} has been permanently rejected.\n\nRejection Details:\n- Reason: {rejection_reason}\n- Rejection Date: {date}\n- Reviewed by: {user_name}\n\nThis record will not be covered under the reinsurance policy.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      
      // === NOTA WORKFLOW ===
      {
        object_type: 'Nota',
        status_from: 'Draft',
        status_to: 'Issued',
        recipient_role: 'BRINS',
        email_subject: '[Nota {nota_number}] Nota Issued',
        email_body: 'Dear BRINS Team,\n\nNota {nota_number} has been issued.\n\nNota Details:\n- Type: {nota_type}\n- Reference: {reference_id}\n- Amount: {amount}\n- Issue Date: {date}\n\nAction Required: Please confirm receipt at your branch.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Nota',
        status_from: 'Issued',
        status_to: 'Confirmed',
        recipient_role: 'TUGURE',
        email_subject: '[Nota {nota_number}] Branch Confirmation',
        email_body: 'Dear TUGURE Team,\n\nNota {nota_number} has been confirmed by Branch.\n\nConfirmation Details:\n- Confirmed by: {user_name}\n- Confirmation Date: {date}\n- Amount: {amount}\n\nNext Step: Please proceed with payment processing.\n\nBest regards,\nBRINS System',
        is_active: true
      },
      {
        object_type: 'Nota',
        status_from: 'Confirmed',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Nota {nota_number}] Payment Completed',
        email_body: 'Dear Team,\n\nPayment completed for Nota {nota_number}.\n\nPayment Details:\n- Amount Paid: {amount}\n- Payment Date: {date}\n- Payment Reference: {payment_reference}\n\nNota is now fully settled.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === CLAIM WORKFLOW ===
      {
        object_type: 'Claim',
        status_from: 'Draft',
        status_to: 'Checked',
        recipient_role: 'BRINS',
        email_subject: '[Claim {claim_no}] Eligibility Check Completed',
        email_body: 'Dear BRINS Team,\n\nClaim {claim_no} has been checked for eligibility.\n\nClaim Details:\n- Debtor: {debtor_name}\n- Claim Amount: {claim_amount}\n- Checked Date: {date}\n- Checked by: {user_name}\n\nNext Step: Document verification process.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Checked',
        status_to: 'Doc Verified',
        recipient_role: 'TUGURE',
        email_subject: '[Claim {claim_no}] Documents Verified',
        email_body: 'Dear TUGURE Team,\n\nAll supporting documents for Claim {claim_no} have been verified.\n\nVerification Details:\n- Claim Amount: {claim_amount}\n- Verified Date: {date}\n- Verified by: {user_name}\n\nNext Step: Invoicing process.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Doc Verified',
        status_to: 'Invoiced',
        recipient_role: 'BRINS',
        email_subject: '[Claim {claim_no}] Claim Invoiced',
        email_body: 'Dear BRINS Team,\n\nClaim {claim_no} has been invoiced.\n\nInvoice Details:\n- Invoice Number: {invoice_number}\n- Invoice Amount: {claim_amount}\n- Invoice Date: {date}\n\nNext Step: Payment processing within SLA.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Claim',
        status_from: 'Invoiced',
        status_to: 'Paid',
        recipient_role: 'ALL',
        email_subject: '[Claim {claim_no}] Settlement Completed',
        email_body: 'Dear Team,\n\nClaim {claim_no} settlement completed.\n\nSettlement Details:\n- Settlement Amount: {claim_amount}\n- Settlement Date: {date}\n- Payment Reference: {settlement_ref}\n\nClaim is now fully settled and closed.\n\nBest regards,\nSystem Automation',
        is_active: true
      },
      
      // === SUBROGATION WORKFLOW ===
      {
        object_type: 'Subrogation',
        status_from: 'Draft',
        status_to: 'Invoiced',
        recipient_role: 'BRINS',
        email_subject: '[Subrogation {subrogation_id}] Recovery Invoice Issued',
        email_body: 'Dear BRINS Team,\n\nSubrogation invoice issued for Claim {claim_id}.\n\nSubrogation Details:\n- Subrogation ID: {subrogation_id}\n- Recovery Amount: {recovery_amount}\n- Invoice Date: {date}\n\nPlease process recovery payment.\n\nBest regards,\nTUGURE Reinsurance System',
        is_active: true
      },
      {
        object_type: 'Subrogation',
        status_from: 'Invoiced',
        status_to: 'Paid / Closed',
        recipient_role: 'ALL',
        email_subject: '[Subrogation {subrogation_id}] Recovery Completed',
        email_body: 'Dear Team,\n\nSubrogation {subrogation_id} completed and closed.\n\nRecovery Summary:\n- Recovery Amount: {recovery_amount}\n- Recovery Date: {date}\n- Related Claim: {claim_id}\n\nSubrogation process is now complete.\n\nBest regards,\nSystem Automation',
        is_active: true
      }
    ];
    
    for (const template of sampleTemplates) {
      try {
        await base44.entities.EmailTemplate.create(template);
      } catch (error) {
        console.error('Failed to create sample template:', error);
      }
    }
  };

  const handleSaveUserSettings = async () => {
    setProcessing(true);
    try {
      const existing = notificationSettings.find(s => s.user_email === user.email);
      
      if (existing) {
        await base44.entities.NotificationSetting.update(existing.id, currentSetting);
      } else {
        await base44.entities.NotificationSetting.create({
          ...currentSetting,
          user_email: user.email,
          user_role: user.role.toUpperCase()
        });
      }

      setSuccessMessage('Settings saved successfully');
      loadData();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setProcessing(false);
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const typeMap = {
        'rules': 'ELIGIBILITY_RULE',
        'thresholds': 'FINANCIAL_THRESHOLD',
        'approval': 'APPROVAL_MATRIX'
      };
      
      const configData = {
        config_type: typeMap[activeTab === 'rules' ? 'rules' : activeTab === 'thresholds' ? 'thresholds' : 'approval'],
        config_key: configKey,
        config_value: configValue,
        description: description,
        is_active: isActive,
        effective_date: new Date().toISOString().split('T')[0],
        status: 'APPROVED'
      };

      if (editingConfig) {
        await base44.entities.SystemConfig.update(editingConfig.id, configData);
      } else {
        await base44.entities.SystemConfig.create(configData);
      }

      setSuccessMessage('Configuration saved successfully');
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
    }
    setProcessing(false);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await base44.entities.Notification.update(notifId, { is_read: true });
      loadData();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleDeleteSettings = async () => {
    if (selectedSettings.length === 0) return;
    
    setProcessing(true);
    try {
      for (const id of selectedSettings) {
        await base44.entities.NotificationSetting.delete(id);
      }
      setSuccessMessage(`Deleted ${selectedSettings.length} settings`);
      setSelectedSettings([]);
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
    setProcessing(false);
  };

  const toggleSettingSelection = (id) => {
    if (selectedSettings.includes(id)) {
      setSelectedSettings(selectedSettings.filter(sid => sid !== id));
    } else {
      setSelectedSettings([...selectedSettings, id]);
    }
  };

  const resetForm = () => {
    setConfigKey('');
    setConfigValue('');
    setDescription('');
    setIsActive(true);
    setEditingConfig(null);
  };

  const openEditDialog = (config) => {
    setEditingConfig(config);
    setConfigKey(config.config_key);
    setConfigValue(config.config_value);
    setDescription(config.description || '');
    setIsActive(config.is_active);
    setShowDialog(true);
  };

  const getConfigsByType = (type) => {
    const typeMap = {
      'rules': 'ELIGIBILITY_RULE',
      'thresholds': 'FINANCIAL_THRESHOLD',
      'approval': 'APPROVAL_MATRIX'
    };
    return systemConfigs.filter(c => c.config_type === typeMap[type]);
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  const configColumns = [
    { header: 'Config Key', cell: (row) => <span className="font-mono text-sm">{row.config_key}</span> },
    { header: 'Value', accessorKey: 'config_value' },
    { header: 'Description', accessorKey: 'description' },
    { 
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm">{row.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
          <Edit className="w-4 h-4" />
        </Button>
      )
    }
  ];

  const settingsColumns = [
    {
      header: (
        <Checkbox
          checked={selectedSettings.length === notificationSettings.length && notificationSettings.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedSettings(notificationSettings.map(s => s.id));
            } else {
              setSelectedSettings([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedSettings.includes(row.id)}
          onCheckedChange={() => toggleSettingSelection(row.id)}
        />
      ),
      width: '50px'
    },
    {
      header: 'User',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.user_email}</p>
          <StatusBadge status={row.user_role} />
        </div>
      )
    },
    {
      header: 'Email',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className={`w-4 h-4 ${row.email_enabled ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm">{row.notification_email || '-'}</span>
        </div>
      )
    },
    {
      header: 'WhatsApp',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-4 h-4 ${row.whatsapp_enabled ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm">{row.whatsapp_number || '-'}</span>
        </div>
      )
    },
    {
      header: 'Notifications',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.notify_on_submit && <Badge variant="outline" className="text-xs">Submit</Badge>}
          {row.notify_on_approval && <Badge variant="outline" className="text-xs">Approval</Badge>}
          {row.notify_on_payment && <Badge variant="outline" className="text-xs">Payment</Badge>}
          {row.notify_on_claim && <Badge variant="outline" className="text-xs">Claim</Badge>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage notifications, settings, and system rules"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'System Configuration' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="email-templates">
            <Mail className="w-4 h-4 mr-2" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="my-settings">
            <User className="w-4 h-4 mr-2" />
            My Settings
          </TabsTrigger>
          <TabsTrigger value="all-settings">
            <Settings className="w-4 h-4 mr-2" />
            All Settings
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Shield className="w-4 h-4 mr-2" />
            Business Rules
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <DollarSign className="w-4 h-4 mr-2" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <div className="space-y-3">
            {unreadNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No unread notifications</p>
                </CardContent>
              </Card>
            ) : (
              unreadNotifications.map((notif) => (
                <Card key={notif.id} className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-blue-100">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                            <Badge variant="outline">{notif.type.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">{notif.module}</Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(notif.created_date), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{notif.message}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark as Read
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="email-templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Email Notification Templates</h3>
              <p className="text-sm text-gray-500">Configure automated email messages for status transitions</p>
            </div>
            <Button onClick={() => { setSelectedTemplate(null); setShowTemplateDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Template
            </Button>
          </div>

          <DataTable
            columns={[
              {
                header: 'Object Type',
                accessorKey: 'object_type',
                cell: (row) => (
                  <Badge variant="outline">{row.object_type}</Badge>
                )
              },
              {
                header: 'Status Transition',
                accessorKey: 'status_to',
                cell: (row) => (
                  <div className="flex items-center gap-2">
                    {row.status_from && <span className="text-gray-500">{row.status_from} →</span>}
                    <span className="font-medium">{row.status_to}</span>
                  </div>
                )
              },
              {
                header: 'Recipient',
                accessorKey: 'recipient_role',
                cell: (row) => <Badge>{row.recipient_role}</Badge>
              },
              {
                header: 'Subject',
                accessorKey: 'email_subject',
                cell: (row) => <span className="text-sm">{row.email_subject}</span>
              },
              {
                header: 'Status',
                accessorKey: 'is_active',
                cell: (row) => (
                  <Badge variant={row.is_active ? 'default' : 'secondary'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                )
              },
              {
                header: 'Actions',
                cell: (row) => (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setSelectedTemplate(row); setShowTemplateDialog(true); }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                )
              }
            ]}
            data={emailTemplates}
            isLoading={loading}
          />
        </TabsContent>

        {/* My Settings Tab */}
        <TabsContent value="my-settings" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email for Notifications</Label>
                  <Input
                    type="email"
                    value={currentSetting.notification_email}
                    onChange={(e) => setCurrentSetting({...currentSetting, notification_email: e.target.value})}
                    placeholder="your.email@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>WhatsApp Number</Label>
                  <Input
                    type="tel"
                    value={currentSetting.whatsapp_number}
                    onChange={(e) => setCurrentSetting({...currentSetting, whatsapp_number: e.target.value})}
                    placeholder="+62812345678"
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Label>Enable Email Notifications</Label>
                  <Switch
                    checked={currentSetting.email_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, email_enabled: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Enable WhatsApp Notifications</Label>
                  <Switch
                    checked={currentSetting.whatsapp_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, whatsapp_enabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Configure which workflow notifications you want to receive</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'notify_batch_status', label: 'Batch Status Changes', description: 'Uploaded → Validated → Matched → Approved → Paid → Closed', color: 'blue' },
                  { key: 'notify_record_status', label: 'Record Status Changes', description: 'Accepted → Revised → Rejected', color: 'indigo' },
                  { key: 'notify_nota_status', label: 'Nota Status Changes', description: 'Draft → Issued → Confirmed → Paid', color: 'purple' },
                  { key: 'notify_claim_status', label: 'Claim Status Changes', description: 'Draft → Checked → Doc Verified → Invoiced → Paid', color: 'pink' },
                  { key: 'notify_subrogation_status', label: 'Subrogation Status Changes', description: 'Draft → Invoiced → Paid/Closed', color: 'orange' },
                  { key: 'notify_payment_received', label: 'Payment Received', description: 'All payment confirmations', color: 'green' },
                  { key: 'notify_approval_required', label: 'Approval Required', description: 'Actions requiring your approval', color: 'yellow' },
                  { key: 'notify_document_verification', label: 'Document Verification', description: 'Document upload and verification updates', color: 'teal' }
                ].map(({ key, label, description, color }) => (
                  <div key={key} className={`flex items-start justify-between p-4 bg-${color}-50 border border-${color}-100 rounded-lg`}>
                    <div className="flex-1">
                      <Label className="font-medium">{label}</Label>
                      <p className="text-xs text-gray-500 mt-1">{description}</p>
                    </div>
                    <Switch
                      checked={currentSetting[key]}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, [key]: checked})}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardContent className="p-6 flex justify-center">
              <Button
                onClick={handleSaveUserSettings}
                disabled={processing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Settings Tab */}
        <TabsContent value="all-settings" className="mt-4">
          {selectedSettings.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{selectedSettings.length} settings selected</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSettings}
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <DataTable
            columns={settingsColumns}
            data={notificationSettings}
            isLoading={loading}
            emptyMessage="No notification settings found"
          />
        </TabsContent>

        {/* Business Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Business Rules</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Configure eligibility criteria and requirements</p>
                </div>
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('rules')}
                isLoading={loading}
                emptyMessage="No rules configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Financial Thresholds</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Set coverage percentages, premium rates, and limits</p>
                </div>
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Threshold
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('thresholds')}
                isLoading={loading}
                emptyMessage="No thresholds configured"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.id ? 'Edit Email Template' : 'Add Email Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Object Type</Label>
                <select
                  value={selectedTemplate?.object_type || 'Batch'}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, object_type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="Batch">Batch</option>
                  <option value="Record">Record</option>
                  <option value="Nota">Nota</option>
                  <option value="Claim">Claim</option>
                  <option value="Subrogation">Subrogation</option>
                </select>
              </div>
              <div>
                <Label>Recipient Role</Label>
                <select
                  value={selectedTemplate?.recipient_role || 'BRINS'}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, recipient_role: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="BRINS">BRINS</option>
                  <option value="TUGURE">TUGURE</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="ALL">ALL</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status From (Optional)</Label>
                <Input
                  value={selectedTemplate?.status_from || ''}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, status_from: e.target.value })}
                  placeholder="e.g., Uploaded"
                />
              </div>
              <div>
                <Label>Status To</Label>
                <Input
                  value={selectedTemplate?.status_to || ''}
                  onChange={(e) => setSelectedTemplate({ ...selectedTemplate, status_to: e.target.value })}
                  placeholder="e.g., Validated"
                />
              </div>
            </div>

            <div>
              <Label>Email Subject</Label>
              <Input
                value={selectedTemplate?.email_subject || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_subject: e.target.value })}
                placeholder="Use variables: {batch_id}, {user_name}, {date}, etc"
              />
            </div>

            <div>
              <Label>Email Body</Label>
              <Textarea
                value={selectedTemplate?.email_body || ''}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, email_body: e.target.value })}
                rows={8}
                placeholder="Use variables: {batch_id}, {user_name}, {date}, {total_premium}, etc"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available variables: {'{batch_id}, {user_name}, {date}, {total_records}, {total_premium}, {amount}, {claim_no}, {debtor_name}'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedTemplate?.is_active !== false}
                onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_active: e.target.checked })}
                className="rounded"
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (selectedTemplate?.id) {
                  await base44.entities.EmailTemplate.update(selectedTemplate.id, selectedTemplate);
                } else {
                  await base44.entities.EmailTemplate.create(selectedTemplate);
                }
                await loadData();
                setShowTemplateDialog(false);
                setSuccessMessage('Email template saved successfully');
              } catch (error) {
                console.error('Failed to save template:', error);
              }
            }}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Add Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Config Key *</Label>
              <Input
                value={configKey}
                onChange={(e) => setConfigKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="e.g., MAX_LOAN_AMOUNT"
              />
            </div>
            <div>
              <Label>Config Value *</Label>
              <Input
                value={configValue}
                onChange={(e) => setConfigValue(e.target.value)}
                placeholder="Enter value"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this configuration..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={processing || !configKey || !configValue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}