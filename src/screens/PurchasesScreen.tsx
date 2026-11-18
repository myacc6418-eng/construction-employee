import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FileCheck2,
  LocateFixed,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { requestCurrentGps } from '../services/capacitorBridge';
import { generateIdempotencyKey } from '../services/offlineSync';
import {
  Button,
  FormField,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  formatINR,
  inferStatusTone,
  inputClass,
} from '../components/ui/Primitives';

interface ExpenseDraftItem {
  materialCategory: string;
  materialName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

function toPaise(v: number): number {
  return Math.round(v * 100);
}

function fromPaise(p: number): number {
  return Math.round(p) / 100;
}

export const PurchasesScreen: React.FC = () => {
  const { bootstrap, queueOrSend } = useWorkforce();
  const emp = bootstrap?.employee;
  const sites = bootstrap?.authorizedSites || [];
  const purchaseRequests = bootstrap?.purchaseRequests || [];
  const purchaseExpenses = bootstrap?.purchaseExpenses || [];
  const works = bootstrap?.workAssignments || [];

  const [tab, setTab] = useState<'expenses' | 'requests'>('expenses');
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Workflow A: Purchase Request Form State
  const [prSiteId, setPrSiteId] = useState(emp?.primarySiteId || sites[0]?.id || '');
  const [prCategory, setPrCategory] = useState('Electrical');
  const [prName, setPrName] = useState('');
  const [prQty, setPrQty] = useState('10');
  const [prUnit, setPrUnit] = useState('nos');
  const [prEstPrice, setPrEstPrice] = useState('150');
  const [prPriority, setPrPriority] = useState<'Urgent' | 'High' | 'Standard'>('High');
  const [prDeliveryDate, setPrDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [prTaskCode, setPrTaskCode] = useState('');
  const [prReason, setPrReason] = useState('');
  const [prPhoto, setPrPhoto] = useState<string | undefined>(undefined);

  // Workflow B: Purchase Expense Submission Form State
  const [exSiteId, setExSiteId] = useState(emp?.primarySiteId || sites[0]?.id || '');
  const [exSupplier, setExSupplier] = useState('');
  const [exSupplierContact, setExSupplierContact] = useState('');
  const [exPurchaseDate, setExPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [exInvoiceNo, setExInvoiceNo] = useState('');
  const [exGstin, setExGstin] = useState('');
  const [exPaymentMethod, setExPaymentMethod] = useState<'UPI' | 'Cash' | 'Personal Card' | 'Company Imprest'>('UPI');
  const [exPaidBy, setExPaidBy] = useState<'Employee Personal Funds' | 'Company Imprest Cash'>('Employee Personal Funds');
  const [exGstPercent, setExGstPercent] = useState('18');
  const [exReason, setExReason] = useState('');
  const [exRemarks, setExRemarks] = useState('');
  const [exTaskCode, setExTaskCode] = useState('');
  const [exItems, setExItems] = useState<ExpenseDraftItem[]>([
    { materialCategory: 'Consumables', materialName: '', quantity: '1', unit: 'nos', unitPrice: '0' },
  ]);
  const [exBillPhotos, setExBillPhotos] = useState<string[]>([]);
  const [exMatPhotos, setExMatPhotos] = useState<string[]>([]);
  const [exGps, setExGps] = useState<{ lat: number; lng: number } | null>(null);

  const calcTotals = useMemo(() => {
    let subPaise = 0;
    for (const item of exItems) {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice) || 0;
      subPaise += Math.round(q * toPaise(p));
    }
    const gst = Number(exGstPercent) || 0;
    const taxPaise = Math.round((subPaise * gst) / 100);
    return {
      subtotal: fromPaise(subPaise),
      taxAmount: fromPaise(taxPaise),
      total: fromPaise(subPaise + taxPaise),
    };
  }, [exItems, exGstPercent]);

  if (!emp) return null;

  const readPhotos = (files: FileList | null, cb: (urls: string[]) => void, max: number) => {
    if (!files) return;
    Array.from(files)
      .slice(0, max)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') cb([reader.result]);
        };
        reader.readAsDataURL(f);
      });
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await queueOrSend({
        kind: 'purchase_expense',
        title: `Purchase Request: ${prName}`,
        endpoint: '/api/purchases/requests',
        payload: {
          siteId: prSiteId,
          materialCategory: prCategory,
          materialName: prName,
          requiredQuantity: Number(prQty),
          unit: prUnit,
          estimatedUnitPrice: Number(prEstPrice),
          priority: prPriority,
          requiredDeliveryDate: prDeliveryDate,
          workTaskCode: prTaskCode || undefined,
          reason: prReason,
          photoDataUrl: prPhoto,
        },
        idempotencyKey: generateIdempotencyKey('pr'),
      });
      setReqModalOpen(false);
      setPrName('');
      setPrReason('');
      setPrPhoto(undefined);
      setNotice(
        res.mode === 'queued'
          ? 'Purchase Request saved on device and queued for sync.'
          : 'Purchase Request submitted to Supervisor → Site Manager → Procurement workflow.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit purchase request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await queueOrSend({
        kind: 'purchase_expense',
        title: `Expense Bill: ${exSupplier} (${formatINR(calcTotals.total)})`,
        endpoint: '/api/purchases/expenses',
        payload: {
          siteId: exSiteId,
          supplierName: exSupplier,
          supplierContact: exSupplierContact || undefined,
          purchaseDate: exPurchaseDate,
          items: exItems.map((i) => ({
            materialCategory: i.materialCategory,
            materialName: i.materialName,
            quantity: Number(i.quantity),
            unit: i.unit,
            unitPrice: Number(i.unitPrice),
          })),
          gstPercent: Number(exGstPercent) || 0,
          paymentMethod: exPaymentMethod,
          paidBy: exPaidBy,
          reason: exReason,
          invoiceNumber: exInvoiceNo,
          supplierGstin: exGstin || undefined,
          billPhotoDataUrls: exBillPhotos,
          materialPhotoDataUrls: exMatPhotos,
          gpsLat: exGps?.lat,
          gpsLng: exGps?.lng,
          capturedAt: new Date().toISOString(),
          remarks: exRemarks || undefined,
          workTaskCode: exTaskCode || undefined,
        },
        idempotencyKey: generateIdempotencyKey('exp'),
      });
      setExpModalOpen(false);
      setExSupplier('');
      setExInvoiceNo('');
      setExReason('');
      setExBillPhotos([]);
      setExMatPhotos([]);
      setExItems([{ materialCategory: 'Consumables', materialName: '', quantity: '1', unit: 'nos', unitPrice: '0' }]);
      setNotice(
        res.mode === 'queued'
          ? 'Purchase expense saved offline (Saved on Device). Will sync when online.'
          : 'Purchase expense submitted. Material Receipt remains Pending until verified by your Storekeeper or Site Engineer.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit purchase expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCaptureGpsForExpense = async () => {
    const gps = await requestCurrentGps(7000);
    if (gps.ok && gps.reading) {
      setExGps({ lat: gps.reading.latitude, lng: gps.reading.longitude });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#101F35]">Materials & Purchase Bills</h1>
          <p className="text-sm text-[#64748B]">
            Request materials for the company to buy, or submit bills for already-purchased consumables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" onClick={() => setReqModalOpen(true)}>
            <ShoppingCart className="w-4 h-4" />
            New Material Request
          </Button>
          <Button variant="primary" size="md" onClick={() => setExpModalOpen(true)}>
            <Receipt className="w-4 h-4" />
            Submit Purchase Bill
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Important Receipt & Reimbursement Separation Info */}
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <PackageCheck className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#101F35]">Material Receipt Is Verified Separately</p>
            <p className="text-[#64748B] mt-0.5">
              Uploading a bill does not mark materials as received. Your Site Storekeeper or Engineer verifies physical receipt before site stock updates.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <FileCheck2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#101F35]">Reimbursement Follows Finance Approval</p>
            <p className="text-[#64748B] mt-0.5">
              Submitting an expense starts Supervisor → Site Manager → Procurement → Finance review. Reimbursed status appears only after Finance payout.
            </p>
          </div>
        </div>
      </div>

      {/* Separated Workflow Tabs */}
      <div className="inline-flex p-1 bg-white border border-[#E2E8F0] rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setTab('expenses')}
          className={`min-h-[40px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            tab === 'expenses' ? 'bg-[#101F35] text-white' : 'text-[#64748B] hover:text-[#101F35]'
          }`}
        >
          B. Purchase Expenses ({purchaseExpenses.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('requests')}
          className={`min-h-[40px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            tab === 'requests' ? 'bg-[#101F35] text-white' : 'text-[#64748B] hover:text-[#101F35]'
          }`}
        >
          A. Material Requests ({purchaseRequests.length})
        </button>
      </div>

      {tab === 'expenses' ? (
        <div className="space-y-4">
          {purchaseExpenses.length === 0 ? (
            <SurfaceCard className="text-center py-8 text-sm text-[#64748B]">
              No purchase expense bills submitted yet.
            </SurfaceCard>
          ) : (
            purchaseExpenses.map((exp) => (
              <SurfaceCard key={exp.id} className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-[#2563EB]">
                        {exp.expenseReference}
                      </span>
                      <span className="text-xs text-[#64748B]">Inv #{exp.invoiceNumber}</span>
                    </div>
                    <h2 className="text-base font-bold text-[#101F35]">{exp.supplierName}</h2>
                    <p className="text-xs text-[#64748B]">
                      {exp.siteName} · {formatDate(exp.purchaseDate)} · Paid via {exp.paymentMethod} ({exp.paidBy})
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xl font-bold font-mono tabular-nums text-[#101F35]">
                      {formatINR(exp.totalAmount)}
                    </p>
                    <p className="text-[11px] font-mono text-[#64748B]">
                      Sub {formatINR(exp.subtotal)} + GST {formatINR(exp.taxAmount)}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F5F7FA] rounded-xl p-3 space-y-1.5 text-xs">
                  {exp.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-[#172B4D]">
                        {item.materialName} ({item.quantity} {item.unit} × {formatINR(item.unitPrice)})
                      </span>
                      <span className="font-mono font-semibold text-[#101F35] tabular-nums">
                        {formatINR(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-[11px] text-[#64748B] block">Expense / Finance Status</span>
                      <StatusLabel label={exp.status} tone={inferStatusTone(exp.status)} />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#64748B] block">Material Receipt Status</span>
                      <StatusLabel label={exp.receiptStatus} tone={inferStatusTone(exp.receiptStatus)} />
                    </div>
                  </div>
                  {exp.receiptVerifiedBy && (
                    <span className="text-xs text-[#64748B]">
                      Verified by {exp.receiptVerifiedBy}
                    </span>
                  )}
                </div>
              </SurfaceCard>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {purchaseRequests.length === 0 ? (
            <SurfaceCard className="text-center py-8 text-sm text-[#64748B]">
              No material purchase requests raised yet.
            </SurfaceCard>
          ) : (
            purchaseRequests.map((pr) => (
              <SurfaceCard key={pr.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#2563EB]">
                      {pr.requestCode} · {pr.priority} Priority
                    </span>
                    <h2 className="text-base font-bold text-[#101F35] mt-0.5">{pr.materialName}</h2>
                    <p className="text-xs text-[#64748B]">
                      {pr.siteName} · {pr.materialCategory} · Need by {formatDate(pr.requiredDeliveryDate)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-base font-bold font-mono tabular-nums text-[#101F35]">
                      {pr.requiredQuantity} {pr.unit} (~{formatINR(pr.estimatedTotal)})
                    </p>
                    <StatusLabel label={pr.status} tone={inferStatusTone(pr.status)} />
                  </div>
                </div>
                <p className="text-xs text-[#172B4D]">{pr.reason}</p>
              </SurfaceCard>
            ))
          )}
        </div>
      )}

      {/* Modal A: New Purchase Request */}
      <ModalSheet
        open={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title="A. Request Material Purchase"
        subtitle="Ask the company procurement team to purchase required site materials"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <FormField label="Site" required>
            <select value={prSiteId} onChange={(e) => setPrSiteId(e.target.value)} className={inputClass}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteName} — {s.projectName}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select value={prCategory} onChange={(e) => setPrCategory(e.target.value)} className={inputClass}>
                <option value="Electrical">Electrical</option>
                <option value="Civil & Masonry">Civil & Masonry</option>
                <option value="Steel & Hardware">Steel & Hardware</option>
                <option value="Finishing & Tiles">Finishing & Tiles</option>
                <option value="Safety PPE">Safety PPE</option>
              </select>
            </FormField>
            <FormField label="Priority">
              <select
                value={prPriority}
                onChange={(e) => setPrPriority(e.target.value as 'Urgent' | 'High' | 'Standard')}
                className={inputClass}
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Standard">Standard</option>
              </select>
            </FormField>
          </div>

          <FormField label="Material Name" required>
            <input
              value={prName}
              onChange={(e) => setPrName(e.target.value)}
              placeholder="e.g. 25mm FRLS PVC Conduit Pipes"
              className={inputClass}
              required
            />
          </FormField>

          <div className="grid grid-cols-3 gap-2.5">
            <FormField label="Qty" required>
              <input type="number" min="1" value={prQty} onChange={(e) => setPrQty(e.target.value)} className={inputClass} required />
            </FormField>
            <FormField label="Unit" required>
              <input value={prUnit} onChange={(e) => setPrUnit(e.target.value)} className={inputClass} required />
            </FormField>
            <FormField label="Est. Rate (₹)">
              <input type="number" min="0" value={prEstPrice} onChange={(e) => setPrEstPrice(e.target.value)} className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Required By">
              <input type="date" value={prDeliveryDate} onChange={(e) => setPrDeliveryDate(e.target.value)} className={inputClass} />
            </FormField>
            <FormField label="Work Task Reference">
              <select value={prTaskCode} onChange={(e) => setPrTaskCode(e.target.value)} className={inputClass}>
                <option value="">Optional task</option>
                {works.map((w) => (
                  <option key={w.id} value={w.taskCode}>
                    {w.taskCode} — {w.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Reason" required>
            <textarea
              rows={2}
              value={prReason}
              onChange={(e) => setPrReason(e.target.value)}
              placeholder="Where will this material be used?"
              className={inputClass}
              required
            />
          </FormField>

          <FormField label="Supporting Photograph (Optional)">
            <label className="min-h-[44px] px-4 py-2 rounded-xl border border-dashed border-[#E2E8F0] text-xs font-medium text-[#2563EB] flex items-center justify-center gap-2 cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>{prPhoto ? 'Photo attached' : 'Attach site / sample photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => readPhotos(e.target.files, (urls) => setPrPhoto(urls[0]), 1)}
                className="sr-only"
              />
            </label>
          </FormField>

          {errorMsg && <p className="text-xs text-[#DC2626]">{errorMsg}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Material Request'}
          </Button>
        </form>
      </ModalSheet>

      {/* Modal B: Submit Purchase Expense */}
      <ModalSheet
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        title="B. Submit Purchase Expense Bill"
        subtitle="Report materials already purchased using personal or imprest funds"
      >
        <form onSubmit={handleSubmitExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Site" required>
              <select value={exSiteId} onChange={(e) => setExSiteId(e.target.value)} className={inputClass}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteName}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Purchase Date" required>
              <input type="date" value={exPurchaseDate} onChange={(e) => setExPurchaseDate(e.target.value)} className={inputClass} required />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Supplier / Shop Name" required>
              <input
                value={exSupplier}
                onChange={(e) => setExSupplier(e.target.value)}
                placeholder="Shop name"
                className={inputClass}
                required
              />
            </FormField>
            <FormField label="Supplier Contact">
              <input
                value={exSupplierContact}
                onChange={(e) => setExSupplierContact(e.target.value)}
                placeholder="+91..."
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Invoice / Bill No." required>
              <input
                value={exInvoiceNo}
                onChange={(e) => setExInvoiceNo(e.target.value)}
                placeholder="INV-1024"
                className={inputClass}
                required
              />
            </FormField>
            <FormField label="Supplier GSTIN (Optional)">
              <input
                value={exGstin}
                onChange={(e) => setExGstin(e.target.value)}
                placeholder="36AABCS..."
                className={inputClass}
              />
            </FormField>
          </div>

          {/* Line Items */}
          <div className="space-y-2.5 border-t border-b border-[#E2E8F0] py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#101F35]">Purchased Line Items</span>
              <button
                type="button"
                onClick={() =>
                  setExItems((prev) => [
                    ...prev,
                    { materialCategory: 'Consumables', materialName: '', quantity: '1', unit: 'nos', unitPrice: '0' },
                  ])
                }
                className="text-xs font-semibold text-[#2563EB] inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            {exItems.map((item, idx) => (
              <div key={idx} className="bg-[#F5F7FA] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={item.materialName}
                    onChange={(e) =>
                      setExItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, materialName: e.target.value } : it))
                      )
                    }
                    placeholder="Material name (e.g. Insulation tape)"
                    className={`${inputClass} flex-1`}
                    required
                  />
                  {exItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#DC2626] cursor-pointer"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      setExItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))
                    }
                    placeholder="Qty"
                    className={inputClass}
                    required
                  />
                  <input
                    value={item.unit}
                    onChange={(e) =>
                      setExItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unit: e.target.value } : it)))
                    }
                    placeholder="Unit"
                    className={inputClass}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setExItems((prev) => prev.map((it, i) => (i === idx ? { ...it, unitPrice: e.target.value } : it)))
                    }
                    placeholder="Unit ₹"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <FormField label="GST %">
              <select value={exGstPercent} onChange={(e) => setExGstPercent(e.target.value)} className={inputClass}>
                <option value="0">0% (No GST)</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </FormField>
            <FormField label="Payment Method">
              <select
                value={exPaymentMethod}
                onChange={(e) =>
                  setExPaymentMethod(e.target.value as 'UPI' | 'Cash' | 'Personal Card' | 'Company Imprest')
                }
                className={inputClass}
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Personal Card">Personal Card</option>
                <option value="Company Imprest">Company Imprest</option>
              </select>
            </FormField>
            <FormField label="Paid By">
              <select
                value={exPaidBy}
                onChange={(e) =>
                  setExPaidBy(e.target.value as 'Employee Personal Funds' | 'Company Imprest Cash')
                }
                className={inputClass}
              >
                <option value="Employee Personal Funds">Personal Funds</option>
                <option value="Company Imprest Cash">Company Imprest</option>
              </select>
            </FormField>
          </div>

          <div className="bg-[#101F35] text-white rounded-xl p-3.5 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-white/75">Subtotal</span>
              <span className="font-mono tabular-nums">{formatINR(calcTotals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/75">Tax (GST {exGstPercent}%)</span>
              <span className="font-mono tabular-nums">{formatINR(calcTotals.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-white/15">
              <span>Total Purchase Amount</span>
              <span className="font-mono tabular-nums text-[#F59E0B]">{formatINR(calcTotals.total)}</span>
            </div>
          </div>

          <FormField label="Reason for Purchase" required>
            <input
              value={exReason}
              onChange={(e) => setExReason(e.target.value)}
              placeholder="e.g. Urgent electrical consumables for Floor 4"
              className={inputClass}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Bill / Invoice Photos">
              <label className="min-h-[44px] px-3 py-2 rounded-xl border border-dashed border-[#2563EB]/40 text-xs font-medium text-[#2563EB] flex items-center justify-center gap-2 cursor-pointer">
                <Receipt className="w-4 h-4" />
                <span>Upload Bill ({exBillPhotos.length})</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    readPhotos(e.target.files, (urls) => setExBillPhotos((p) => [...p, ...urls].slice(0, 3)), 3)
                  }
                  className="sr-only"
                />
              </label>
            </FormField>
            <FormField label="Material / Delivery Photos">
              <label className="min-h-[44px] px-3 py-2 rounded-xl border border-dashed border-[#2563EB]/40 text-xs font-medium text-[#2563EB] flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>Add Material Photos ({exMatPhotos.length})</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    readPhotos(e.target.files, (urls) => setExMatPhotos((p) => [...p, ...urls].slice(0, 6)), 6)
                  }
                  className="sr-only"
                />
              </label>
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs bg-[#F5F7FA] rounded-xl px-3.5 py-2.5">
            <span className="text-[#64748B]">
              {exGps
                ? `GPS attached: ${exGps.lat.toFixed(4)}, ${exGps.lng.toFixed(4)}`
                : 'Attach GPS location (optional)'}
            </span>
            <button
              type="button"
              onClick={() => void handleCaptureGpsForExpense()}
              className="font-semibold text-[#2563EB] inline-flex items-center gap-1 cursor-pointer"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              Tag GPS
            </button>
          </div>

          <FormField label="Remarks / Task Ref">
            <input
              value={exRemarks}
              onChange={(e) => setExRemarks(e.target.value)}
              placeholder="Handed over to storekeeper..."
              className={inputClass}
            />
          </FormField>

          {errorMsg && <p className="text-xs text-[#DC2626]">{errorMsg}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Purchase Expense'}
          </Button>
        </form>
      </ModalSheet>
    </div>
  );
};
