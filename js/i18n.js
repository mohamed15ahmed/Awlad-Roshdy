// =========================================================
// i18n.js — Arabic is the default/primary language (section 6).
// English is an optional secondary language, switchable in Settings.
// =========================================================
import { getSetting, setSetting } from "./db.js";

const dict = {
  ar: {
    app_name: "أولاد رشدي", app_name_en: "Awlad Roshdy", app_manager: "Manager",
    tagline: "Smart Supermarket Management", powered_by_ai: "Powered by AI",
    nav_home: "الرئيسية", nav_companies: "الشركات", nav_invoices: "الفواتير",
    nav_search: "البحث", nav_settings: "الإعدادات",
    online: "متصل بالإنترنت", offline: "تعمل بدون إنترنت",
    good_morning: "صباح الخير", good_afternoon: "مساء الخير", good_evening: "مساء الخير",
    stat_companies: "إجمالي الشركات", stat_invoices: "إجمالي الفواتير",
    stat_invoices_month: "فواتير هذا الشهر", stat_purchases_month: "مشتريات هذا الشهر",
    stat_pending_sync: "بانتظار المزامنة", stat_storage: "المساحة المستخدمة",
    quick_add_company: "إضافة شركة", quick_add_invoice: "إضافة فاتورة",
    quick_scan_invoice: "تصوير فاتورة", quick_search: "البحث عن فاتورة", quick_ai: "المساعد الذكي",
    recent_invoices: "أحدث الفواتير", view_all: "عرض الكل",
    alert_pending_sync: "توجد فواتير في انتظار المزامنة",
    alert_sync_failed: "فشلت مزامنة بعض البيانات",
    alert_possible_duplicate: "توجد فاتورة مكررة محتملة",
    alert_low_storage: "مساحة التخزين منخفضة",
    login_title: "تسجيل الدخول", email: "البريد الإلكتروني", password: "كلمة المرور",
    login_btn: "دخول", remember_device: "تذكر هذا الجهاز",
    err_invalid_email: "البريد الإلكتروني غير صحيح",
    err_invalid_password: "كلمة المرور غير صحيحة",
    err_offline: "لا يوجد اتصال بالإنترنت",
    err_unauthorized: "الحساب غير مصرح له بالدخول",
    err_generic: "حدث خطأ، حاول مرة أخرى",
    err_locked: "تم تجاوز عدد المحاولات، حاول مرة أخرى بعد قليل",
    setup_title: "إعداد حساب المدير", setup_desc: "هذا أول تشغيل للتطبيق — أنشئ حساب المدير للدخول لاحقاً.",
    setup_btn: "إنشاء الحساب والدخول",
    companies_title: "الشركات", add_company: "إضافة شركة", edit_company: "تعديل الشركة",
    company_name: "اسم الشركة", representative_name: "اسم المندوب", phone: "الهاتف",
    whatsapp: "واتساب", address: "العنوان", category: "التصنيف", notes: "ملاحظات",
    favorite: "إضافة للمفضلة", save: "حفظ", save_and_add_invoice: "حفظ وإضافة فاتورة", cancel: "إلغاء",
    no_companies_title: "لم تتم إضافة أي شركات بعد", no_companies_sub: "ابدأ بإضافة أول شركة",
    company_required: "اسم الشركة مطلوب", phone_invalid: "رقم الهاتف غير صحيح",
    possible_duplicate_company: "توجد شركة بنفس الاسم تقريباً، تأكد قبل الحفظ",
    saved_success: "تم الحفظ بنجاح",
    call: "اتصال", open_whatsapp: "واتساب", details: "التفاصيل",
    invoices_count: "عدد الفواتير", last_invoice_date: "تاريخ آخر فاتورة",
    invoices_title: "الفواتير", add_invoice: "إضافة فاتورة",
    invoice_number: "رقم الفاتورة", invoice_date: "تاريخ الفاتورة", subtotal: "الإجمالي قبل الضريبة",
    tax: "الضريبة", total: "الإجمالي", upload_file: "اختيار ملف", take_photo: "تصوير بالكاميرا",
    no_invoices_title: "لا توجد فواتير حتى الآن", no_invoices_sub: "ابدأ بإضافة أول فاتورة",
    review_title: "مراجعة الفاتورة", edit_data: "تعديل البيانات", save_invoice: "حفظ الفاتورة",
    retake: "إعادة التصوير", ocr_note: "راجع البيانات المستخرجة قبل الحفظ — لا تُحفظ تلقائياً",
    file_required: "يجب اختيار ملف الفاتورة (صورة أو PDF)",
    invoice_number_hint: "اختياري — لكنه يساعد على تنظيم الأرشيف والبحث",
    search_placeholder: "ابحث عن شركة، رقم فاتورة، مبلغ...",
    no_results_title: "لم نجد نتائج مطابقة", no_results_sub: "جرّب كلمة بحث أخرى أو غيّر الفلاتر",
    clear_filters: "مسح الفلاتر", filters: "الفلاتر",
    settings_title: "الإعدادات", account: "الحساب", security: "الأمان", appearance: "المظهر",
    language: "اللغة", sync: "المزامنة", storage: "التخزين", backup: "النسخ الاحتياطي",
    logout: "تسجيل الخروج", dark_mode: "الوضع الليلي", change_password: "تغيير كلمة المرور",
    sync_now: "مزامنة الآن", last_sync: "آخر مزامنة ناجحة", pending_ops: "العمليات المعلقة",
    clear_cache: "مسح ذاكرة التخزين المؤقت", export_backup: "تصدير نسخة احتياطية",
    import_backup: "استيراد نسخة احتياطية",
    about_title: "عن التطبيق", version: "الإصدار", management: "إدارة",
    trash_title: "سلة المحذوفات", restore: "استعادة", delete_forever: "حذف نهائي",
    empty_trash_title: "سلة المحذوفات فارغة",
    confirm_delete: "هل أنت متأكد من الحذف؟ يمكن استعادته من سلة المحذوفات لاحقاً.",
    confirm_delete_forever: "هذا الإجراء نهائي ولا يمكن التراجع عنه. متابعة؟",
    yes_delete: "نعم، حذف", no_cancel: "تراجع",
    local_only_banner: "غير متصل بالسحابة — تعمل محلياً فقط. البيانات محفوظة على جهازك.",
    offline_state_title: "أنت تعمل بدون إنترنت", offline_state_sub: "يمكنك استخدام البيانات المحفوظة وإضافة بيانات جديدة",
    sync_local: "محلي فقط", sync_pending: "بانتظار المزامنة", sync_syncing: "جارِ المزامنة",
    sync_synced: "تمت المزامنة", sync_failed: "فشلت المزامنة", sync_deleted: "محذوف",
    dup_warning_title: "تنبيه: قد تكون هذه الفاتورة مكررة",
    required_field: "هذا الحقل مطلوب",
    weak_password: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
    passwords_no_match: "كلمتا المرور غير متطابقتين",
    confirm_password: "تأكيد كلمة المرور",
    file_too_large: "حجم الملف أكبر من الحد المسموح",
    file_type_invalid: "نوع الملف غير مدعوم",
    ai_placeholder: "المساعد الذكي قيد التطوير — سيتم تفعيله في نسخة قادمة بعد استقرار الأرشفة الأساسية.",
  },
  en: {
    app_name: "Awlad Roshdy", app_name_en: "Awlad Roshdy", app_manager: "Manager",
    tagline: "Smart Supermarket Management", powered_by_ai: "Powered by AI",
    nav_home: "Home", nav_companies: "Companies", nav_invoices: "Invoices",
    nav_search: "Search", nav_settings: "Settings",
    online: "Online", offline: "Working offline",
    good_morning: "Good morning", good_afternoon: "Good afternoon", good_evening: "Good evening",
    stat_companies: "Total companies", stat_invoices: "Total invoices",
    stat_invoices_month: "Invoices this month", stat_purchases_month: "Purchases this month",
    stat_pending_sync: "Pending sync", stat_storage: "Storage used",
    quick_add_company: "Add company", quick_add_invoice: "Add invoice",
    quick_scan_invoice: "Scan invoice", quick_search: "Search invoice", quick_ai: "AI assistant",
    recent_invoices: "Recent invoices", view_all: "View all",
    alert_pending_sync: "Some invoices are waiting to sync",
    alert_sync_failed: "Some data failed to sync",
    alert_possible_duplicate: "A possible duplicate invoice was found",
    alert_low_storage: "Local storage is low",
    login_title: "Sign in", email: "Email", password: "Password",
    login_btn: "Sign in", remember_device: "Remember this device",
    err_invalid_email: "Invalid email address",
    err_invalid_password: "Incorrect password",
    err_offline: "No internet connection",
    err_unauthorized: "This account is not authorized",
    err_generic: "Something went wrong, please try again",
    err_locked: "Too many attempts — please try again shortly",
    setup_title: "Set up admin account", setup_desc: "First run — create the admin account to sign in later.",
    setup_btn: "Create account & sign in",
    companies_title: "Companies", add_company: "Add company", edit_company: "Edit company",
    company_name: "Company name", representative_name: "Representative name", phone: "Phone",
    whatsapp: "WhatsApp", address: "Address", category: "Category", notes: "Notes",
    favorite: "Add to favorites", save: "Save", save_and_add_invoice: "Save & add invoice", cancel: "Cancel",
    no_companies_title: "No companies yet", no_companies_sub: "Start by adding your first company",
    company_required: "Company name is required", phone_invalid: "Invalid phone number",
    possible_duplicate_company: "A similarly named company already exists — please check before saving",
    saved_success: "Saved successfully",
    call: "Call", open_whatsapp: "WhatsApp", details: "Details",
    invoices_count: "Invoices", last_invoice_date: "Last invoice date",
    invoices_title: "Invoices", add_invoice: "Add invoice",
    invoice_number: "Invoice number", invoice_date: "Invoice date", subtotal: "Subtotal",
    tax: "Tax", total: "Total", upload_file: "Choose file", take_photo: "Take photo",
    no_invoices_title: "No invoices yet", no_invoices_sub: "Start by adding your first invoice",
    review_title: "Review invoice", edit_data: "Edit data", save_invoice: "Save invoice",
    retake: "Retake photo", ocr_note: "Review extracted data before saving — never saved automatically",
    file_required: "An invoice file (image or PDF) is required",
    invoice_number_hint: "Optional — helps you organize and search the archive",
    search_placeholder: "Search company, invoice #, amount...",
    no_results_title: "No matching results", no_results_sub: "Try another search term or change the filters",
    clear_filters: "Clear filters", filters: "Filters",
    settings_title: "Settings", account: "Account", security: "Security", appearance: "Appearance",
    language: "Language", sync: "Sync", storage: "Storage", backup: "Backup",
    logout: "Log out", dark_mode: "Dark mode", change_password: "Change password",
    sync_now: "Sync now", last_sync: "Last successful sync", pending_ops: "Pending operations",
    clear_cache: "Clear cache", export_backup: "Export backup", import_backup: "Import backup",
    about_title: "About", version: "Version", management: "Management",
    trash_title: "Trash", restore: "Restore", delete_forever: "Delete permanently",
    empty_trash_title: "Trash is empty",
    confirm_delete: "Delete this item? You can restore it from Trash later.",
    confirm_delete_forever: "This action is permanent and cannot be undone. Continue?",
    yes_delete: "Yes, delete", no_cancel: "Cancel",
    local_only_banner: "Not connected to the cloud — running locally only. Your data stays on this device.",
    offline_state_title: "You're working offline", offline_state_sub: "You can use saved data and add new data",
    sync_local: "Local only", sync_pending: "Pending sync", sync_syncing: "Syncing",
    sync_synced: "Synced", sync_failed: "Sync failed", sync_deleted: "Deleted",
    dup_warning_title: "Warning: this invoice might be a duplicate",
    required_field: "This field is required",
    weak_password: "Password must be at least 8 characters",
    passwords_no_match: "Passwords do not match",
    confirm_password: "Confirm password",
    file_too_large: "File size exceeds the allowed limit",
    file_type_invalid: "Unsupported file type",
    ai_placeholder: "The AI assistant is under development — it will be enabled once core archiving is stable.",
  },
};

let currentLang = "ar";

export function t(key) {
  return dict[currentLang][key] ?? dict.ar[key] ?? key;
}

export function getLanguage() { return currentLang; }

export async function initLanguage() {
  currentLang = (await getSetting("language", "ar")) || "ar";
  applyDirection();
  return currentLang;
}

export async function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "ar";
  await setSetting("language", currentLang);
  applyDirection();
}

function applyDirection() {
  const html = document.documentElement;
  html.lang = currentLang;
  html.dir = currentLang === "ar" ? "rtl" : "ltr";
}
