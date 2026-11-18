import React, { useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, Lock, Upload } from 'lucide-react';
import { useWorkforce } from '../context/WorkforceContext';
import { apiRequest } from '../services/apiClient';
import type { EmployeeDocument } from '../types/buildflow';
import {
  Button,
  ModalSheet,
  StatusLabel,
  SurfaceCard,
  formatDate,
  inferStatusTone,
} from '../components/ui/Primitives';

export const DocumentsScreen: React.FC = () => {
  const { bootstrap, token, refreshData } = useWorkforce();
  const emp = bootstrap?.employee;
  const documents = bootstrap?.documents || [];

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [viewingDoc, setViewingDoc] = useState<EmployeeDocument | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!emp) return null;

  const categories = ['All', ...Array.from(new Set(documents.map((d) => d.category)))];
  const filtered =
    categoryFilter === 'All' ? documents : documents.filter((d) => d.category === categoryFilter);

  const handleUpload = async (doc: EmployeeDocument, file: File | undefined) => {
    if (!file) return;
    await apiRequest(`/api/documents/${doc.id}/upload`, {
      method: 'POST',
      token,
      body: { fileName: file.name },
    });
    await refreshData();
    setNotice(`Uploaded "${file.name}" for ${doc.title}. Status updated to Uploaded.`);
  };

  const handleDownloadSummary = (doc: EmployeeDocument) => {
    const content = `BuildFlow Private Employee Document\n\nEmployee: ${emp.fullName} (${emp.employeeCode})\nTitle: ${doc.title}\nCategory: ${doc.category}\nStatus: ${doc.status}\nIssued: ${doc.issuedDate || 'N/A'}\nDocument Ref: ${doc.documentNumber || doc.id}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.employeeCode}-${doc.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#101F35]">My Documents</h1>
        <p className="text-sm text-[#64748B]">
          Private company-issued records and identity verification documents.
        </p>
      </div>

      {notice && (
        <div className="rounded-2xl bg-[#EAF2FF] border border-[#2563EB]/25 p-3.5 text-sm text-[#101F35] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#2563EB] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              categoryFilter === cat
                ? 'bg-[#101F35] text-white border-[#101F35]'
                : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#101F35]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((doc) => (
          <SurfaceCard key={doc.id} className="flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#64748B]">{doc.category}</span>
                <StatusLabel label={doc.status} tone={inferStatusTone(doc.status)} />
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#101F35]">{doc.title}</h2>
                  {doc.documentNumber && (
                    <p className="text-xs font-mono text-[#64748B]">ID: {doc.documentNumber}</p>
                  )}
                  {doc.issuedDate && (
                    <p className="text-xs text-[#64748B]">Issued: {formatDate(doc.issuedDate)}</p>
                  )}
                  {doc.expiryDate && (
                    <p className="text-xs text-[#64748B]">Valid until: {formatDate(doc.expiryDate)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E2E8F0]">
              <Button variant="secondary" size="md" onClick={() => setViewingDoc(doc)}>
                <Eye className="w-4 h-4" />
                View
              </Button>
              {doc.downloadAllowed && (
                <Button variant="secondary" size="md" onClick={() => handleDownloadSummary(doc)}>
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              )}
              {doc.status === 'Requested' && (
                <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-[#1D4ED8]">
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => void handleUpload(doc, e.target.files?.[0])}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </SurfaceCard>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-[#E2E8F0] px-4 py-3 text-xs text-[#64748B] flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#16A34A] shrink-0" />
        <span>
          Documents are stored privately per worker profile with no public permanent URLs.
        </span>
      </div>

      <ModalSheet
        open={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc?.title || 'Document'}
        subtitle={viewingDoc ? `${viewingDoc.category} · Private Access` : ''}
      >
        {viewingDoc && (
          <div className="space-y-4 text-sm">
            <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Holder</span>
                <strong className="text-[#101F35]">
                  {emp.fullName} ({emp.employeeCode})
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Verification Status</span>
                <StatusLabel label={viewingDoc.status} tone={inferStatusTone(viewingDoc.status)} />
              </div>
              {viewingDoc.fileName && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Uploaded File</span>
                  <span className="font-mono text-[#101F35]">{viewingDoc.fileName}</span>
                </div>
              )}
              {viewingDoc.category === 'Identity Documents' && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Masked KYC ID</span>
                  <span className="font-mono text-[#101F35]">{emp.aadhaarMasked}</span>
                </div>
              )}
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={() => setViewingDoc(null)}>
              Close
            </Button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
