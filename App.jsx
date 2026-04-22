import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "reserve_inventory_data_v10";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        shelfMasters: [],
        masters: [],
        receipts: [],
        shipments: [],
        plannedReceipts: [],
      };
    }

    const parsed = JSON.parse(raw);

    return {
      shelfMasters: Array.isArray(parsed.shelfMasters) ? parsed.shelfMasters : [],
      masters: Array.isArray(parsed.masters) ? parsed.masters : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
      shipments: Array.isArray(parsed.shipments) ? parsed.shipments : [],
      plannedReceipts: Array.isArray(parsed.plannedReceipts) ? parsed.plannedReceipts : [],
    };
  } catch {
    return {
      shelfMasters: [],
      masters: [],
      receipts: [],
      shipments: [],
      plannedReceipts: [],
    };
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const csvLines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvLines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvText(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  return lines.map((line) => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }

    result.push(current.trim());
    return result;
  });
}

const pageStyle = {
  padding: "20px",
  fontFamily: "sans-serif",
  background: "#f5f7fb",
  minHeight: "100vh",
  color: "#1f2937",
};

const titleStyle = {
  fontSize: "34px",
  marginBottom: "20px",
};

const inputStyle = {
  padding: "14px 16px",
  fontSize: "22px",
  minHeight: "58px",
  minWidth: "220px",
  borderRadius: "12px",
  border: "1px solid #94a3b8",
  boxSizing: "border-box",
  background: "#ffffff",
};

const buttonStyle = {
  padding: "14px 18px",
  fontSize: "20px",
  minHeight: "58px",
  cursor: "pointer",
  borderRadius: "12px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
};

const primaryButtonStyle = {
  ...buttonStyle,
  background: "#dbeafe",
  border: "1px solid #60a5fa",
  fontWeight: "bold",
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: "#fee2e2",
  border: "1px solid #f87171",
};

const sectionStyle = {
  marginTop: "20px",
  padding: "20px",
  border: "1px solid #d1d5db",
  borderRadius: "16px",
  background: "#ffffff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const smallButtonStyle = {
  padding: "10px 14px",
  fontSize: "18px",
  cursor: "pointer",
  marginRight: "8px",
  marginBottom: "6px",
  borderRadius: "10px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
};

const smallDangerButtonStyle = {
  ...smallButtonStyle,
  background: "#fee2e2",
  border: "1px solid #f87171",
};

const tableWrapStyle = {
  overflowX: "auto",
  border: "1px solid #d1d5db",
  borderRadius: "12px",
};

const tableStyle = {
  borderCollapse: "collapse",
  width: "100%",
  fontSize: "20px",
  background: "#ffffff",
};

const thStyle = {
  borderBottom: "1px solid #cbd5e1",
  padding: "12px",
  textAlign: "left",
  verticalAlign: "top",
  background: "#e2e8f0",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle = {
  borderBottom: "1px solid #e5e7eb",
  padding: "12px",
  textAlign: "left",
  verticalAlign: "top",
};

const highlightCardStyle = {
  marginTop: "18px",
  background: "#eef6ff",
  padding: "18px",
  borderRadius: "14px",
  fontSize: "24px",
  lineHeight: "1.8",
  border: "2px solid #93c5fd",
};

export default function App() {
  const initialData = loadData();

  const [activeTab, setActiveTab] = useState("shelfMaster");
  const [shelfMasters, setShelfMasters] = useState(initialData.shelfMasters);
  const [masters, setMasters] = useState(initialData.masters);
  const [receipts, setReceipts] = useState(initialData.receipts);
  const [shipments, setShipments] = useState(initialData.shipments);
  const [plannedReceipts, setPlannedReceipts] = useState(initialData.plannedReceipts);

  const [shelfMasterForm, setShelfMasterForm] = useState({
    shelfNo: "",
    shelfName: "",
    remark: "",
  });

  const [masterForm, setMasterForm] = useState({
    partNo: "",
    partName: "",
  });

  const [receiptForm, setReceiptForm] = useState({
    shelfNo: "",
    partNo: "",
    boxCount: "",
    receiptDate: todayStr(),
  });

  const [shipmentForm, setShipmentForm] = useState({
    partNo: "",
  });

  const [plannedReceiptForm, setPlannedReceiptForm] = useState({
    planId: "",
    shelfNo: "",
    boxCount: "",
    receiptDate: todayStr(),
  });

  const [shipmentPreview, setShipmentPreview] = useState(null);
  const [editingShelfMasterId, setEditingShelfMasterId] = useState(null);
  const [editingMasterId, setEditingMasterId] = useState(null);
  const [editingReceiptId, setEditingReceiptId] = useState(null);

  const [stockSearch, setStockSearch] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [shelfSearch, setShelfSearch] = useState("");
  const [plannedSearch, setPlannedSearch] = useState("");

  const [message, setMessage] = useState("");

  const fileInputRef = useRef(null);
  const shelfMasterCsvInputRef = useRef(null);
  const partMasterCsvInputRef = useRef(null);
  const receiptCsvInputRef = useRef(null);
  const plannedReceiptCsvInputRef = useRef(null);

  useEffect(() => {
    const saveData = {
      shelfMasters,
      masters,
      receipts,
      shipments,
      plannedReceipts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, [shelfMasters, masters, receipts, shipments, plannedReceipts]);

  function setInfo(text) {
    setMessage(text);
    window.setTimeout(() => {
      setMessage((current) => (current === text ? "" : current));
    }, 3000);
  }

  function getPartName(partNo) {
    const found = masters.find((m) => m.partNo === partNo);
    return found ? found.partName : "";
  }

  function getShelfName(shelfNo) {
    const found = shelfMasters.find((s) => s.shelfNo === shelfNo);
    return found ? found.shelfName : "";
  }

  function getPlanStatus(plan) {
    if (plan.remainingQty <= 0) return "完了";
    if (plan.remainingQty < plan.planQty) return "一部入庫";
    return "未完了";
  }

  function isShelfInUse(shelfNo, excludeReceiptId = null) {
    return receipts.some((r) => {
      if (excludeReceiptId && r.id === excludeReceiptId) return false;
      if (r.shelfNo !== shelfNo) return false;

      const shipped = shipments
        .filter((s) => s.receiptId === r.id && !s.canceled)
        .reduce((sum, s) => sum + s.boxCount, 0);

      const remaining = r.boxCount - shipped;
      return remaining > 0;
    });
  }

  const availableShelfMasters = useMemo(() => {
    return shelfMasters.filter((s) => !isShelfInUse(s.shelfNo));
  }, [shelfMasters, receipts, shipments]);

  const selectableShelfMasters = useMemo(() => {
    if (!editingReceiptId) return availableShelfMasters;

    const editingReceipt = receipts.find((r) => r.id === editingReceiptId);
    if (!editingReceipt) return availableShelfMasters;

    const exists = availableShelfMasters.some(
      (s) => s.shelfNo === editingReceipt.shelfNo
    );
    if (exists) return availableShelfMasters;

    const currentShelf = shelfMasters.find(
      (s) => s.shelfNo === editingReceipt.shelfNo
    );
    if (!currentShelf) return availableShelfMasters;

    return [currentShelf, ...availableShelfMasters];
  }, [availableShelfMasters, editingReceiptId, receipts, shelfMasters]);

  function addOrUpdateShelfMaster() {
    const shelfNo = shelfMasterForm.shelfNo.trim().toUpperCase();
    const shelfName = shelfMasterForm.shelfName.trim();
    const remark = shelfMasterForm.remark.trim();

    if (!shelfNo) {
      alert("棚番を入力してください");
      return;
    }

    const exists = shelfMasters.some(
      (s) => s.shelfNo === shelfNo && s.id !== editingShelfMasterId
    );
    if (exists) {
      alert("その棚番はすでに登録されています");
      return;
    }

    if (editingShelfMasterId) {
      const oldShelf = shelfMasters.find((s) => s.id === editingShelfMasterId);
      const oldShelfNo = oldShelf ? oldShelf.shelfNo : "";

      setShelfMasters((prev) =>
        prev.map((s) =>
          s.id === editingShelfMasterId
            ? { ...s, shelfNo, shelfName, remark }
            : s
        )
      );

      if (oldShelfNo && oldShelfNo !== shelfNo) {
        setReceipts((prev) =>
          prev.map((r) => (r.shelfNo === oldShelfNo ? { ...r, shelfNo } : r))
        );
        setShipments((prev) =>
          prev.map((s) => (s.shelfNo === oldShelfNo ? { ...s, shelfNo } : s))
        );
      }

      setEditingShelfMasterId(null);
      setInfo("棚番マスタを更新しました");
    } else {
      const newShelfMaster = {
        id: Date.now() + Math.random(),
        shelfNo,
        shelfName,
        remark,
      };
      setShelfMasters([...shelfMasters, newShelfMaster]);
      setInfo("棚番マスタを登録しました");
    }

    setShelfMasterForm({
      shelfNo: "",
      shelfName: "",
      remark: "",
    });
  }

  function editShelfMaster(shelf) {
    setShelfMasterForm({
      shelfNo: shelf.shelfNo,
      shelfName: shelf.shelfName,
      remark: shelf.remark,
    });
    setEditingShelfMasterId(shelf.id);
    setActiveTab("shelfMaster");
  }

  function deleteShelfMaster(id) {
    const target = shelfMasters.find((s) => s.id === id);
    if (!target) return;

    const usedInReceipt = receipts.some((r) => r.shelfNo === target.shelfNo);
    const usedInShipment = shipments.some((s) => s.shelfNo === target.shelfNo);

    if (usedInReceipt || usedInShipment) {
      alert("この棚番は入出庫データで使用中のため削除できません");
      return;
    }

    const ok = window.confirm("この棚番マスタを削除しますか？");
    if (!ok) return;

    setShelfMasters(shelfMasters.filter((s) => s.id !== id));

    if (editingShelfMasterId === id) {
      setEditingShelfMasterId(null);
      setShelfMasterForm({ shelfNo: "", shelfName: "", remark: "" });
    }

    setInfo("棚番マスタを削除しました");
  }

  function cancelShelfMasterEdit() {
    setEditingShelfMasterId(null);
    setShelfMasterForm({
      shelfNo: "",
      shelfName: "",
      remark: "",
    });
  }

  function addOrUpdateMaster() {
    const partNo = masterForm.partNo.trim().toUpperCase();
    const partName = masterForm.partName.trim();

    if (!partNo) {
      alert("品番を入力してください");
      return;
    }

    const exists = masters.some(
      (m) => m.partNo === partNo && m.id !== editingMasterId
    );
    if (exists) {
      alert("その品番はすでに登録されています");
      return;
    }

    if (editingMasterId) {
      const oldMaster = masters.find((m) => m.id === editingMasterId);
      const oldPartNo = oldMaster ? oldMaster.partNo : "";

      setMasters((prev) =>
        prev.map((m) =>
          m.id === editingMasterId ? { ...m, partNo, partName } : m
        )
      );

      if (oldPartNo && oldPartNo !== partNo) {
        setReceipts((prev) =>
          prev.map((r) => (r.partNo === oldPartNo ? { ...r, partNo } : r))
        );
        setShipments((prev) =>
          prev.map((s) => (s.partNo === oldPartNo ? { ...s, partNo } : s))
        );
        setPlannedReceipts((prev) =>
          prev.map((p) => (p.partNo === oldPartNo ? { ...p, partNo } : p))
        );
      }

      setEditingMasterId(null);
      setInfo("品番マスタを更新しました");
    } else {
      const newMaster = {
        id: Date.now() + Math.random(),
        partNo,
        partName,
      };
      setMasters([...masters, newMaster]);
      setInfo("品番マスタを登録しました");
    }

    setMasterForm({ partNo: "", partName: "" });
  }

  function editMaster(master) {
    setMasterForm({
      partNo: master.partNo,
      partName: master.partName,
    });
    setEditingMasterId(master.id);
    setActiveTab("master");
  }

  function deleteMaster(id) {
    const target = masters.find((m) => m.id === id);
    if (!target) return;

    const usedInReceipt = receipts.some((r) => r.partNo === target.partNo);
    const usedInShipment = shipments.some((s) => s.partNo === target.partNo);
    const usedInPlan = plannedReceipts.some((p) => p.partNo === target.partNo);

    if (usedInReceipt || usedInShipment || usedInPlan) {
      alert("この品番は使用中のため削除できません");
      return;
    }

    const ok = window.confirm("この品番マスタを削除しますか？");
    if (!ok) return;

    setMasters(masters.filter((m) => m.id !== id));

    if (editingMasterId === id) {
      setEditingMasterId(null);
      setMasterForm({ partNo: "", partName: "" });
    }

    setInfo("品番マスタを削除しました");
  }

  function cancelMasterEdit() {
    setEditingMasterId(null);
    setMasterForm({ partNo: "", partName: "" });
  }

  function addOrUpdateReceipt() {
    const shelfNo = receiptForm.shelfNo.trim().toUpperCase();
    const partNo = receiptForm.partNo.trim().toUpperCase();
    const boxCount = Number(receiptForm.boxCount);
    const receiptDate = receiptForm.receiptDate;

    if (!shelfNo || !partNo || !boxCount || !receiptDate) {
      alert("入庫の項目を全部入力してください");
      return;
    }

    if (boxCount <= 0) {
      alert("箱数は1以上を入力してください");
      return;
    }

    const shelfExists = shelfMasters.some((s) => s.shelfNo === shelfNo);
    if (!shelfExists) {
      alert("その棚番は棚番マスタにありません");
      return;
    }

    const masterExists = masters.some((m) => m.partNo === partNo);
    if (!masterExists) {
      alert("その品番は品番マスタにありません");
      return;
    }

    const excludeId = editingReceiptId ? editingReceiptId : null;
    if (isShelfInUse(shelfNo, excludeId)) {
      alert("その棚番は現在使用中です。空いている棚番を選んでください");
      return;
    }

    if (editingReceiptId) {
      const hasShipment = shipments.some(
        (s) => s.receiptId === editingReceiptId && !s.canceled
      );
      if (hasShipment) {
        alert("すでに出庫に使われた入庫データは編集できません");
        return;
      }

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === editingReceiptId
            ? { ...r, shelfNo, partNo, boxCount, receiptDate }
            : r
        )
      );
      setEditingReceiptId(null);
      setInfo("入庫データを更新しました");
    } else {
      const newReceipt = {
        id: Date.now() + Math.random(),
        shelfNo,
        partNo,
        boxCount,
        receiptDate,
      };
      setReceipts([...receipts, newReceipt]);
      setInfo("入庫登録しました");
    }

    setReceiptForm({
      shelfNo: "",
      partNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });
  }

  function registerPlannedReceiptToStock() {
    const planId = plannedReceiptForm.planId;
    const shelfNo = plannedReceiptForm.shelfNo.trim().toUpperCase();
    const boxCount = Number(plannedReceiptForm.boxCount);
    const receiptDate = plannedReceiptForm.receiptDate;

    if (!planId) {
      alert("予定を選んでください");
      return;
    }

    if (!shelfNo || !boxCount || !receiptDate) {
      alert("棚番・入庫箱数・入庫日を入力してください");
      return;
    }

    if (boxCount <= 0) {
      alert("入庫箱数は1以上を入力してください");
      return;
    }

    const plan = plannedReceipts.find((p) => p.id === planId);
    if (!plan) {
      alert("対象の入庫予定が見つかりません");
      return;
    }

    if (plan.remainingQty <= 0) {
      alert("この予定はすでに完了しています");
      return;
    }

    if (boxCount > plan.remainingQty) {
      alert("入庫箱数は残箱数以下にしてください");
      return;
    }

    const shelfExists = shelfMasters.some((s) => s.shelfNo === shelfNo);
    if (!shelfExists) {
      alert("その棚番は棚番マスタにありません");
      return;
    }

    if (isShelfInUse(shelfNo)) {
      alert("その棚番は現在使用中です。空いている棚番を選んでください");
      return;
    }

    const newReceipt = {
      id: Date.now() + Math.random(),
      shelfNo,
      partNo: plan.partNo,
      boxCount,
      receiptDate,
      sourcePlanId: plan.id,
    };

    setReceipts((prev) => [...prev, newReceipt]);
    setPlannedReceipts((prev) =>
      prev.map((p) =>
        p.id === plan.id
          ? {
              ...p,
              remainingQty: p.remainingQty - boxCount,
            }
          : p
      )
    );

    setPlannedReceiptForm({
      planId: "",
      shelfNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });

    setInfo("入庫予定から入庫登録しました");
  }

  function startPlannedReceipt(plan) {
    if (plan.remainingQty <= 0) {
      alert("この予定は完了しています");
      return;
    }

    setPlannedReceiptForm({
      planId: plan.id,
      shelfNo: "",
      boxCount: String(plan.remainingQty),
      receiptDate: todayStr(),
    });
    setActiveTab("plannedReceipt");
  }

  function deletePlannedReceipt(id) {
    const target = plannedReceipts.find((p) => p.id === id);
    if (!target) return;

    const usedInReceipt = receipts.some((r) => r.sourcePlanId === id);
    if (usedInReceipt) {
      alert("この予定はすでに入庫実績に使われているため削除できません");
      return;
    }

    const ok = window.confirm("この入庫予定を削除しますか？");
    if (!ok) return;

    setPlannedReceipts((prev) => prev.filter((p) => p.id !== id));
    if (plannedReceiptForm.planId === id) {
      setPlannedReceiptForm({
        planId: "",
        shelfNo: "",
        boxCount: "",
        receiptDate: todayStr(),
      });
    }
    setInfo("入庫予定を削除しました");
  }

  function cancelPlannedReceiptInput() {
    setPlannedReceiptForm({
      planId: "",
      shelfNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });
  }

  function editReceipt(receipt) {
    const hasShipment = shipments.some(
      (s) => s.receiptId === receipt.id && !s.canceled
    );
    if (hasShipment) {
      alert("すでに出庫に使われた入庫データは編集できません");
      return;
    }

    setReceiptForm({
      shelfNo: receipt.shelfNo,
      partNo: receipt.partNo,
      boxCount: String(receipt.boxCount),
      receiptDate: receipt.receiptDate,
    });
    setEditingReceiptId(receipt.id);
    setActiveTab("receipt");
  }

  function deleteReceipt(id) {
    const hasShipment = shipments.some(
      (s) => s.receiptId === id && !s.canceled
    );
    if (hasShipment) {
      alert("すでに出庫に使われた入庫データは削除できません");
      return;
    }

    const target = receipts.find((r) => r.id === id);
    if (!target) return;

    const ok = window.confirm("この入庫データを削除しますか？");
    if (!ok) return;

    if (target.sourcePlanId) {
      setPlannedReceipts((prev) =>
        prev.map((p) =>
          p.id === target.sourcePlanId
            ? { ...p, remainingQty: p.remainingQty + target.boxCount }
            : p
        )
      );
    }

    setReceipts(receipts.filter((r) => r.id !== id));

    if (editingReceiptId === id) {
      setEditingReceiptId(null);
      setReceiptForm({
        shelfNo: "",
        partNo: "",
        boxCount: "",
        receiptDate: todayStr(),
      });
    }

    setInfo("入庫データを削除しました");
  }

  function cancelReceiptEdit() {
    setEditingReceiptId(null);
    setReceiptForm({
      shelfNo: "",
      partNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });
  }

  const stockList = useMemo(() => {
    return receipts
      .map((r) => {
        const shipped = shipments
          .filter((s) => s.receiptId === r.id && !s.canceled)
          .reduce((sum, s) => sum + s.boxCount, 0);

        return {
          ...r,
          remaining: r.boxCount - shipped,
        };
      })
      .filter((r) => r.remaining > 0)
      .sort((a, b) => {
        if (a.partNo !== b.partNo) {
          return a.partNo.localeCompare(b.partNo, "ja");
        }
        if (a.receiptDate !== b.receiptDate) {
          return a.receiptDate.localeCompare(b.receiptDate);
        }
        return a.shelfNo.localeCompare(b.shelfNo, "ja");
      });
  }, [receipts, shipments]);

  const stockSummary = useMemo(() => {
    const map = {};
    for (const row of stockList) {
      if (!map[row.partNo]) map[row.partNo] = 0;
      map[row.partNo] += row.remaining;
    }

    return Object.entries(map)
      .map(([partNo, total]) => ({ partNo, total }))
      .sort((a, b) => a.partNo.localeCompare(b.partNo, "ja"));
  }, [stockList]);

  const stockKeyword = stockSearch.trim().toUpperCase();
  const filteredStockSummary = useMemo(() => {
    if (!stockKeyword) return stockSummary;
    return stockSummary.filter(
      (s) =>
        s.partNo.includes(stockKeyword) ||
        getPartName(s.partNo).toUpperCase().includes(stockKeyword)
    );
  }, [stockSummary, stockKeyword, masters]);

  const filteredStockList = useMemo(() => {
    if (!stockKeyword) return stockList;
    return stockList.filter(
      (r) =>
        r.partNo.includes(stockKeyword) ||
        r.shelfNo.includes(stockKeyword) ||
        getPartName(r.partNo).toUpperCase().includes(stockKeyword) ||
        getShelfName(r.shelfNo).toUpperCase().includes(stockKeyword)
    );
  }, [stockList, stockKeyword, masters, shelfMasters]);

  const receiptKeyword = receiptSearch.trim().toUpperCase();
  const filteredReceipts = useMemo(() => {
    if (!receiptKeyword) return receipts;
    return receipts.filter(
      (r) =>
        r.partNo.includes(receiptKeyword) ||
        r.shelfNo.includes(receiptKeyword) ||
        getPartName(r.partNo).toUpperCase().includes(receiptKeyword) ||
        getShelfName(r.shelfNo).toUpperCase().includes(receiptKeyword) ||
        r.receiptDate.includes(receiptKeyword)
    );
  }, [receipts, receiptKeyword, masters, shelfMasters]);

  const shipmentKeyword = shipmentSearch.trim().toUpperCase();
  const filteredShipments = useMemo(() => {
    if (!shipmentKeyword) return shipments;
    return shipments.filter(
      (s) =>
        s.partNo.includes(shipmentKeyword) ||
        s.shelfNo.includes(shipmentKeyword) ||
        getPartName(s.partNo).toUpperCase().includes(shipmentKeyword) ||
        getShelfName(s.shelfNo).toUpperCase().includes(shipmentKeyword) ||
        s.shipmentDate.includes(shipmentKeyword)
    );
  }, [shipments, shipmentKeyword, masters, shelfMasters]);

  const plannedKeyword = plannedSearch.trim().toUpperCase();
  const filteredPlannedReceipts = useMemo(() => {
    if (!plannedKeyword) return plannedReceipts;
    return plannedReceipts.filter(
      (p) =>
        p.partNo.includes(plannedKeyword) ||
        getPartName(p.partNo).toUpperCase().includes(plannedKeyword) ||
        getPlanStatus(p).includes(plannedKeyword)
    );
  }, [plannedReceipts, plannedKeyword, masters]);

  const shelfKeyword = shelfSearch.trim().toUpperCase();
  const shelfHistory = useMemo(() => {
    if (!shelfKeyword) return [];

    const receiptEvents = receipts
      .filter((r) => r.shelfNo.includes(shelfKeyword))
      .map((r) => ({
        id: `R-${r.id}`,
        eventType: "入庫",
        shelfNo: r.shelfNo,
        shelfName: getShelfName(r.shelfNo),
        partNo: r.partNo,
        partName: getPartName(r.partNo),
        qty: r.boxCount,
        date: r.receiptDate,
        note: `入庫 ${r.boxCount}箱`,
      }));

    const shipmentEvents = shipments
      .filter((s) => s.shelfNo.includes(shelfKeyword))
      .map((s) => ({
        id: `S-${s.id}`,
        eventType: s.canceled ? "出庫取消" : "出庫",
        shelfNo: s.shelfNo,
        shelfName: getShelfName(s.shelfNo),
        partNo: s.partNo,
        partName: getPartName(s.partNo),
        qty: s.boxCount,
        date: s.canceled ? s.canceledAt || s.shipmentDate : s.shipmentDate,
        note: s.canceled ? `取消 ${s.boxCount}箱` : `出庫 ${s.boxCount}箱`,
      }));

    return [...receiptEvents, ...shipmentEvents].sort((a, b) => {
      if (a.shelfNo !== b.shelfNo) return a.shelfNo.localeCompare(b.shelfNo, "ja");
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.eventType.localeCompare(b.eventType, "ja");
    });
  }, [shelfKeyword, receipts, shipments, masters, shelfMasters]);

  function previewShipmentAction() {
    const partNo = shipmentForm.partNo.trim().toUpperCase();
    if (!partNo) {
      alert("出庫する品番を入力してください");
      return;
    }

    const candidates = stockList
      .filter((r) => r.partNo === partNo)
      .sort((a, b) => {
        if (a.receiptDate !== b.receiptDate) {
          return a.receiptDate.localeCompare(b.receiptDate);
        }
        return a.shelfNo.localeCompare(b.shelfNo, "ja");
      });

    if (candidates.length === 0) {
      alert("その品番の在庫がありません");
      setShipmentPreview(null);
      return;
    }

    const oldest = candidates[0];

    setShipmentPreview({
      receiptId: oldest.id,
      partNo: oldest.partNo,
      partName: getPartName(oldest.partNo),
      shelfNo: oldest.shelfNo,
      shelfName: getShelfName(oldest.shelfNo),
      receiptDate: oldest.receiptDate,
      boxCount: oldest.remaining,
    });
  }

  function doShipment() {
    if (!shipmentPreview) {
      alert("先に出庫確認をしてください");
      return;
    }

    const ok = window.confirm(
      `品番: ${shipmentPreview.partNo}\n棚番: ${shipmentPreview.shelfNo}\n箱数: ${shipmentPreview.boxCount}箱\nこの内容で出庫しますか？`
    );
    if (!ok) return;

    const newShipment = {
      id: Date.now() + Math.random(),
      receiptId: shipmentPreview.receiptId,
      partNo: shipmentPreview.partNo,
      shelfNo: shipmentPreview.shelfNo,
      receiptDate: shipmentPreview.receiptDate,
      boxCount: shipmentPreview.boxCount,
      shipmentDate: todayStr(),
      canceled: false,
      canceledAt: "",
    };

    setShipments([...shipments, newShipment]);
    setShipmentForm({ partNo: "" });
    setShipmentPreview(null);
    setInfo("出庫登録しました");
  }

  function cancelShipment(id) {
    const target = shipments.find((s) => s.id === id);
    if (!target) return;
    if (target.canceled) {
      alert("この出庫はすでに取消済みです");
      return;
    }

    const ok = window.confirm("この出庫を取消しますか？ 在庫に戻ります。");
    if (!ok) return;

    setShipments((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, canceled: true, canceledAt: todayStr() } : s
      )
    );
    setInfo("出庫を取消しました");
  }

  function deleteShipment(id) {
    const ok = window.confirm("この出庫履歴を削除しますか？");
    if (!ok) return;
    setShipments(shipments.filter((s) => s.id !== id));
    setInfo("出庫履歴を削除しました");
  }

  function clearAllData() {
    const ok = window.confirm("全データを削除します。よろしいですか？");
    if (!ok) return;

    setShelfMasters([]);
    setMasters([]);
    setReceipts([]);
    setShipments([]);
    setPlannedReceipts([]);
    setShipmentPreview(null);
    setEditingShelfMasterId(null);
    setEditingMasterId(null);
    setEditingReceiptId(null);
    setShelfMasterForm({ shelfNo: "", shelfName: "", remark: "" });
    setMasterForm({ partNo: "", partName: "" });
    setReceiptForm({
      shelfNo: "",
      partNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });
    setShipmentForm({ partNo: "" });
    setPlannedReceiptForm({
      planId: "",
      shelfNo: "",
      boxCount: "",
      receiptDate: todayStr(),
    });
    setShelfSearch("");

    localStorage.removeItem(STORAGE_KEY);
    alert("全データを削除しました");
  }

  function exportBackup() {
    const backupData = {
      appName: "reserve_inventory",
      version: 6,
      exportedAt: new Date().toISOString(),
      data: {
        shelfMasters,
        masters,
        receipts,
        shipments,
        plannedReceipts,
      },
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ymd = todayStr().replaceAll("-", "");
    a.href = url;
    a.download = `reserve_inventory_backup_${ymd}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setInfo("バックアップを保存しました");
  }

  function openImportDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const sourceData = parsed.data ? parsed.data : parsed;

        const nextShelfMasters = Array.isArray(sourceData.shelfMasters)
          ? sourceData.shelfMasters
          : [];
        const nextMasters = Array.isArray(sourceData.masters)
          ? sourceData.masters
          : [];
        const nextReceipts = Array.isArray(sourceData.receipts)
          ? sourceData.receipts
          : [];
        const nextShipments = Array.isArray(sourceData.shipments)
          ? sourceData.shipments
          : [];
        const nextPlannedReceipts = Array.isArray(sourceData.plannedReceipts)
          ? sourceData.plannedReceipts
          : [];

        const ok = window.confirm("現在のデータを上書きして復元します。よろしいですか？");
        if (!ok) return;

        setShelfMasters(nextShelfMasters);
        setMasters(nextMasters);
        setReceipts(nextReceipts);
        setShipments(nextShipments);
        setPlannedReceipts(nextPlannedReceipts);
        setShipmentPreview(null);
        setEditingShelfMasterId(null);
        setEditingMasterId(null);
        setEditingReceiptId(null);
        setShelfMasterForm({ shelfNo: "", shelfName: "", remark: "" });
        setMasterForm({ partNo: "", partName: "" });
        setReceiptForm({
          shelfNo: "",
          partNo: "",
          boxCount: "",
          receiptDate: todayStr(),
        });
        setShipmentForm({ partNo: "" });
        setPlannedReceiptForm({
          planId: "",
          shelfNo: "",
          boxCount: "",
          receiptDate: todayStr(),
        });
        setInfo("バックアップを復元しました");
      } catch {
        alert("バックアップファイルの読み込みに失敗しました");
      }
    };

    reader.readAsText(file);
  }

  function openShelfMasterCsvDialog() {
    if (shelfMasterCsvInputRef.current) {
      shelfMasterCsvInputRef.current.value = "";
      shelfMasterCsvInputRef.current.click();
    }
  }

  function importShelfMasterCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvText(text);

        if (rows.length === 0) {
          alert("CSVにデータがありません");
          return;
        }

        const header = rows[0].map((v) => v.trim());
        const shelfNoIndex = header.indexOf("棚番");
        const shelfNameIndex = header.indexOf("棚名");
        const remarkIndex = header.indexOf("備考");

        if (shelfNoIndex === -1) {
          alert("棚番列がありません。見出しに『棚番』が必要です");
          return;
        }

        let added = 0;
        let skipped = 0;
        const existingShelfNos = new Set(shelfMasters.map((s) => s.shelfNo));
        const newItems = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const shelfNo = (row[shelfNoIndex] || "").trim().toUpperCase();
          const shelfName =
            shelfNameIndex >= 0 ? (row[shelfNameIndex] || "").trim() : "";
          const remark =
            remarkIndex >= 0 ? (row[remarkIndex] || "").trim() : "";

          if (!shelfNo) {
            skipped++;
            continue;
          }

          if (existingShelfNos.has(shelfNo)) {
            skipped++;
            continue;
          }

          existingShelfNos.add(shelfNo);
          newItems.push({
            id: Date.now() + Math.random() + i,
            shelfNo,
            shelfName,
            remark,
          });
          added++;
        }

        if (newItems.length > 0) {
          setShelfMasters((prev) => [...prev, ...newItems]);
        }

        alert(`棚番マスタ取込完了\n追加: ${added}件\nスキップ: ${skipped}件`);
      } catch {
        alert("棚番マスタCSVの取込に失敗しました");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function openPartMasterCsvDialog() {
    if (partMasterCsvInputRef.current) {
      partMasterCsvInputRef.current.value = "";
      partMasterCsvInputRef.current.click();
    }
  }

  function importPartMasterCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvText(text);

        if (rows.length === 0) {
          alert("CSVにデータがありません");
          return;
        }

        const header = rows[0].map((v) => v.trim());
        const partNoIndex = header.indexOf("品番");
        const partNameIndex = header.indexOf("品名");

        if (partNoIndex === -1) {
          alert("品番列がありません。見出しに『品番』が必要です");
          return;
        }

        let added = 0;
        let skipped = 0;
        const existingPartNos = new Set(masters.map((m) => m.partNo));
        const newItems = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const partNo = (row[partNoIndex] || "").trim().toUpperCase();
          const partName =
            partNameIndex >= 0 ? (row[partNameIndex] || "").trim() : "";

          if (!partNo) {
            skipped++;
            continue;
          }

          if (existingPartNos.has(partNo)) {
            skipped++;
            continue;
          }

          existingPartNos.add(partNo);
          newItems.push({
            id: Date.now() + Math.random() + i,
            partNo,
            partName,
          });
          added++;
        }

        if (newItems.length > 0) {
          setMasters((prev) => [...prev, ...newItems]);
        }

        alert(`品番マスタ取込完了\n追加: ${added}件\nスキップ: ${skipped}件`);
      } catch {
        alert("品番マスタCSVの取込に失敗しました");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function openReceiptCsvDialog() {
    if (receiptCsvInputRef.current) {
      receiptCsvInputRef.current.value = "";
      receiptCsvInputRef.current.click();
    }
  }

  function importReceiptCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvText(text);

        if (rows.length === 0) {
          alert("CSVにデータがありません");
          return;
        }

        const header = rows[0].map((v) => v.trim());
        const shelfNoIndex = header.indexOf("棚番");
        const partNoIndex = header.indexOf("品番");
        const boxCountIndex = header.indexOf("箱数");
        const receiptDateIndex = header.indexOf("入庫日");

        if (
          shelfNoIndex === -1 ||
          partNoIndex === -1 ||
          boxCountIndex === -1 ||
          receiptDateIndex === -1
        ) {
          alert("見出しは『棚番,品番,箱数,入庫日』が必要です");
          return;
        }

        let added = 0;
        let skipped = 0;

        const existingRows = new Set(
          receipts.map((r) => `${r.shelfNo}__${r.partNo}__${r.boxCount}__${r.receiptDate}`)
        );

        const newItems = [];
        const tempUsedShelfNos = new Set();

        for (const r of receipts) {
          const shipped = shipments
            .filter((s) => s.receiptId === r.id && !s.canceled)
            .reduce((sum, s) => sum + s.boxCount, 0);

          const remaining = r.boxCount - shipped;
          if (remaining > 0) {
            tempUsedShelfNos.add(r.shelfNo);
          }
        }

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];

          const shelfNo = (row[shelfNoIndex] || "").trim().toUpperCase();
          const partNo = (row[partNoIndex] || "").trim().toUpperCase();
          const boxCount = Number((row[boxCountIndex] || "").trim());
          const receiptDate = (row[receiptDateIndex] || "").trim();

          if (!shelfNo || !partNo || !boxCount || !receiptDate) {
            skipped++;
            continue;
          }

          if (boxCount <= 0) {
            skipped++;
            continue;
          }

          const shelfExists = shelfMasters.some((s) => s.shelfNo === shelfNo);
          const partExists = masters.some((m) => m.partNo === partNo);

          if (!shelfExists || !partExists) {
            skipped++;
            continue;
          }

          if (tempUsedShelfNos.has(shelfNo)) {
            skipped++;
            continue;
          }

          const rowKey = `${shelfNo}__${partNo}__${boxCount}__${receiptDate}`;
          if (existingRows.has(rowKey)) {
            skipped++;
            continue;
          }

          existingRows.add(rowKey);
          tempUsedShelfNos.add(shelfNo);

          newItems.push({
            id: Date.now() + Math.random() + i,
            shelfNo,
            partNo,
            boxCount,
            receiptDate,
          });
          added++;
        }

        if (newItems.length > 0) {
          setReceipts((prev) => [...prev, ...newItems]);
        }

        alert(`入庫CSV取込完了\n追加: ${added}件\nスキップ: ${skipped}件`);
      } catch {
        alert("入庫CSVの取込に失敗しました");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function openPlannedReceiptCsvDialog() {
    if (plannedReceiptCsvInputRef.current) {
      plannedReceiptCsvInputRef.current.value = "";
      plannedReceiptCsvInputRef.current.click();
    }
  }

  function importPlannedReceiptCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const rows = parseCsvText(text);

        if (rows.length === 0) {
          alert("CSVにデータがありません");
          return;
        }

        const header = rows[0].map((v) => v.trim());
        const partNoIndex = header.indexOf("品番");
        const boxCountIndex = header.indexOf("箱数");

        if (partNoIndex === -1 || boxCountIndex === -1) {
          alert("見出しは『品番,箱数』が必要です");
          return;
        }

        let added = 0;
        let skipped = 0;
        const newItems = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const partNo = (row[partNoIndex] || "").trim().toUpperCase();
          const boxCount = Number((row[boxCountIndex] || "").trim());

          if (!partNo || !boxCount) {
            skipped++;
            continue;
          }

          if (boxCount <= 0) {
            skipped++;
            continue;
          }

          const partExists = masters.some((m) => m.partNo === partNo);
          if (!partExists) {
            skipped++;
            continue;
          }

          newItems.push({
            id: Date.now() + Math.random() + i,
            partNo,
            planQty: boxCount,
            remainingQty: boxCount,
            createdAt: todayStr(),
          });
          added++;
        }

        if (newItems.length > 0) {
          setPlannedReceipts((prev) => [...prev, ...newItems]);
        }

        alert(`入庫予定CSV取込完了\n追加: ${added}件\nスキップ: ${skipped}件`);
      } catch {
        alert("入庫予定CSVの取込に失敗しました");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  function exportStockCsv() {
    const rows = filteredStockList.map((r) => [
      r.shelfNo,
      getShelfName(r.shelfNo),
      r.partNo,
      getPartName(r.partNo),
      r.remaining,
      r.receiptDate,
    ]);

    downloadCsv(
      `stock_${todayStr().replaceAll("-", "")}.csv`,
      ["棚番", "棚名", "品番", "品名", "残箱数", "入庫日"],
      rows
    );
    setInfo("在庫一覧CSVを出力しました");
  }

  function exportReceiptCsv() {
    const rows = filteredReceipts.map((r) => [
      r.shelfNo,
      getShelfName(r.shelfNo),
      r.partNo,
      getPartName(r.partNo),
      r.boxCount,
      r.receiptDate,
    ]);

    downloadCsv(
      `receipts_${todayStr().replaceAll("-", "")}.csv`,
      ["棚番", "棚名", "品番", "品名", "箱数", "入庫日"],
      rows
    );
    setInfo("入庫履歴CSVを出力しました");
  }

  function exportShipmentCsv() {
    const rows = filteredShipments.map((s) => [
      s.partNo,
      getPartName(s.partNo),
      s.shelfNo,
      getShelfName(s.shelfNo),
      s.boxCount,
      s.shipmentDate,
      s.canceled ? "取消済" : "有効",
      s.canceledAt || "",
    ]);

    downloadCsv(
      `shipments_${todayStr().replaceAll("-", "")}.csv`,
      ["品番", "品名", "棚番", "棚名", "出庫箱数", "出庫日", "状態", "取消日"],
      rows
    );
    setInfo("出庫履歴CSVを出力しました");
  }

  function TabButton({ id, label }) {
    return (
      <button
        style={{
          ...buttonStyle,
          background: activeTab === id ? "#dbeafe" : "#fff",
          border: activeTab === id ? "1px solid #60a5fa" : "1px solid #94a3b8",
          fontWeight: "bold",
        }}
        onClick={() => setActiveTab(id)}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>リザーブ在庫システム</h1>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        <button style={buttonStyle} onClick={exportBackup}>バックアップ保存</button>
        <button style={buttonStyle} onClick={openImportDialog}>復元読み込み</button>
        <button style={dangerButtonStyle} onClick={clearAllData}>全データ削除</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={importBackup}
        />
      </div>

      {message && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            background: "#ecfccb",
            border: "1px solid #84cc16",
            borderRadius: "12px",
            fontSize: "18px",
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <TabButton id="shelfMaster" label="棚番マスタ" />
        <TabButton id="master" label="品番マスタ" />
        <TabButton id="plannedReceipt" label="入庫予定" />
        <TabButton id="receipt" label="入庫" />
        <TabButton id="shipment" label="出庫" />
        <TabButton id="stock" label="在庫一覧" />
        <TabButton id="receiptHistory" label="入庫履歴" />
        <TabButton id="shipmentHistory" label="出庫履歴" />
        <TabButton id="shelfHistory" label="棚番別履歴" />
      </div>

      {activeTab === "shelfMaster" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>棚番マスタ登録</h2>
            <button style={buttonStyle} onClick={openShelfMasterCsvDialog}>CSV取込</button>
            <input
              ref={shelfMasterCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={importShelfMasterCsv}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="棚番"
              value={shelfMasterForm.shelfNo}
              onChange={(e) => setShelfMasterForm({ ...shelfMasterForm, shelfNo: e.target.value })}
            />
            <input
              style={inputStyle}
              type="text"
              placeholder="棚名"
              value={shelfMasterForm.shelfName}
              onChange={(e) => setShelfMasterForm({ ...shelfMasterForm, shelfName: e.target.value })}
            />
            <input
              style={inputStyle}
              type="text"
              placeholder="備考"
              value={shelfMasterForm.remark}
              onChange={(e) => setShelfMasterForm({ ...shelfMasterForm, remark: e.target.value })}
            />
            <button style={primaryButtonStyle} onClick={addOrUpdateShelfMaster}>
              {editingShelfMasterId ? "棚番更新" : "棚番登録"}
            </button>
            {editingShelfMasterId && (
              <button style={buttonStyle} onClick={cancelShelfMasterEdit}>編集取消</button>
            )}
          </div>

          <div style={{ ...tableWrapStyle, marginTop: "15px" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>棚番</th>
                  <th style={thStyle}>棚名</th>
                  <th style={thStyle}>備考</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {shelfMasters.map((s) => (
                  <tr key={s.id}>
                    <td style={tdStyle}>{s.shelfNo}</td>
                    <td style={tdStyle}>{s.shelfName}</td>
                    <td style={tdStyle}>{s.remark}</td>
                    <td style={tdStyle}>
                      <button style={smallButtonStyle} onClick={() => editShelfMaster(s)}>編集</button>
                      <button style={smallDangerButtonStyle} onClick={() => deleteShelfMaster(s.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {shelfMasters.length === 0 && (
                  <tr><td style={tdStyle} colSpan="4">棚番マスタがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "master" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>品番マスタ登録</h2>
            <button style={buttonStyle} onClick={openPartMasterCsvDialog}>CSV取込</button>
            <input
              ref={partMasterCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={importPartMasterCsv}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="品番"
              value={masterForm.partNo}
              onChange={(e) => setMasterForm({ ...masterForm, partNo: e.target.value })}
            />
            <input
              style={inputStyle}
              type="text"
              placeholder="品名"
              value={masterForm.partName}
              onChange={(e) => setMasterForm({ ...masterForm, partName: e.target.value })}
            />
            <button style={primaryButtonStyle} onClick={addOrUpdateMaster}>
              {editingMasterId ? "品番更新" : "品番登録"}
            </button>
            {editingMasterId && (
              <button style={buttonStyle} onClick={cancelMasterEdit}>編集取消</button>
            )}
          </div>

          <div style={{ ...tableWrapStyle, marginTop: "15px" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {masters.map((m) => (
                  <tr key={m.id}>
                    <td style={tdStyle}>{m.partNo}</td>
                    <td style={tdStyle}>{m.partName}</td>
                    <td style={tdStyle}>
                      <button style={smallButtonStyle} onClick={() => editMaster(m)}>編集</button>
                      <button style={smallDangerButtonStyle} onClick={() => deleteMaster(m.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {masters.length === 0 && (
                  <tr><td style={tdStyle} colSpan="3">品番マスタがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "plannedReceipt" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>入庫予定</h2>
            <button style={buttonStyle} onClick={openPlannedReceiptCsvDialog}>予定CSV取込</button>
            <input
              ref={plannedReceiptCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={importPlannedReceiptCsv}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              style={{ ...inputStyle, width: "100%", maxWidth: "500px" }}
              type="text"
              placeholder="品番・品名・状態で検索"
              value={plannedSearch}
              onChange={(e) => setPlannedSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
            <select
              style={inputStyle}
              value={plannedReceiptForm.planId}
              onChange={(e) => setPlannedReceiptForm({ ...plannedReceiptForm, planId: e.target.value })}
            >
              <option value="">予定を選択</option>
              {plannedReceipts
                .filter((p) => p.remainingQty > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partNo} / 残 {p.remainingQty}箱
                  </option>
                ))}
            </select>

            <input
              style={inputStyle}
              type="text"
              placeholder="棚番（空棚のみ）"
              value={plannedReceiptForm.shelfNo}
              onChange={(e) =>
                setPlannedReceiptForm({
                  ...plannedReceiptForm,
                  shelfNo: e.target.value.toUpperCase(),
                })
              }
              list="planned-shelfnos"
            />
            <datalist id="planned-shelfnos">
              {availableShelfMasters.map((s) => (
                <option key={s.id} value={s.shelfNo}>{s.shelfName}</option>
              ))}
            </datalist>

            <input
              style={inputStyle}
              type="number"
              placeholder="入庫箱数"
              value={plannedReceiptForm.boxCount}
              onChange={(e) =>
                setPlannedReceiptForm({
                  ...plannedReceiptForm,
                  boxCount: e.target.value,
                })
              }
            />

            <input
              style={inputStyle}
              type="date"
              value={plannedReceiptForm.receiptDate}
              onChange={(e) =>
                setPlannedReceiptForm({
                  ...plannedReceiptForm,
                  receiptDate: e.target.value,
                })
              }
            />

            <button style={primaryButtonStyle} onClick={registerPlannedReceiptToStock}>
              予定から入庫登録
            </button>

            <button style={buttonStyle} onClick={cancelPlannedReceiptInput}>
              入力取消
            </button>
          </div>

          <div style={{ marginTop: "8px", marginBottom: "14px", fontSize: "16px", color: "#475569" }}>
            入庫予定CSVの見出しは <strong>品番,箱数</strong> です。
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>予定箱数</th>
                  <th style={thStyle}>残箱数</th>
                  <th style={thStyle}>作成日</th>
                  <th style={thStyle}>状態</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlannedReceipts.map((p) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.partNo}</td>
                    <td style={tdStyle}>{getPartName(p.partNo)}</td>
                    <td style={tdStyle}>{p.planQty}</td>
                    <td style={tdStyle}>{p.remainingQty}</td>
                    <td style={tdStyle}>{p.createdAt}</td>
                    <td style={tdStyle}>{getPlanStatus(p)}</td>
                    <td style={tdStyle}>
                      {p.remainingQty > 0 && (
                        <button style={smallButtonStyle} onClick={() => startPlannedReceipt(p)}>
                          この予定から入庫
                        </button>
                      )}
                      <button style={smallDangerButtonStyle} onClick={() => deletePlannedReceipt(p.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPlannedReceipts.length === 0 && (
                  <tr><td style={tdStyle} colSpan="7">入庫予定がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "receipt" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>入庫登録</h2>
            <button style={buttonStyle} onClick={openReceiptCsvDialog}>CSV取込</button>
            <input
              ref={receiptCsvInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={importReceiptCsv}
            />
            <div style={{ fontSize: "18px" }}>空いている棚番数: {availableShelfMasters.length}</div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="棚番（空棚のみ）"
              value={receiptForm.shelfNo}
              onChange={(e) =>
                setReceiptForm({
                  ...receiptForm,
                  shelfNo: e.target.value.toUpperCase(),
                })
              }
              list="shelfnos"
            />
            <datalist id="shelfnos">
              {selectableShelfMasters.map((s) => (
                <option key={s.id} value={s.shelfNo}>{s.shelfName}</option>
              ))}
            </datalist>

            <input
              style={inputStyle}
              type="text"
              placeholder="品番"
              value={receiptForm.partNo}
              onChange={(e) =>
                setReceiptForm({
                  ...receiptForm,
                  partNo: e.target.value.toUpperCase(),
                })
              }
              list="partnos"
            />
            <datalist id="partnos">
              {masters.map((m) => (
                <option key={m.id} value={m.partNo}>{m.partName}</option>
              ))}
            </datalist>

            <input
              style={inputStyle}
              type="number"
              placeholder="箱数"
              value={receiptForm.boxCount}
              onChange={(e) =>
                setReceiptForm({
                  ...receiptForm,
                  boxCount: e.target.value,
                })
              }
            />

            <input
              style={inputStyle}
              type="date"
              value={receiptForm.receiptDate}
              onChange={(e) =>
                setReceiptForm({
                  ...receiptForm,
                  receiptDate: e.target.value,
                })
              }
            />

            <button style={primaryButtonStyle} onClick={addOrUpdateReceipt}>
              {editingReceiptId ? "入庫更新" : "入庫登録"}
            </button>

            {editingReceiptId && (
              <button style={buttonStyle} onClick={cancelReceiptEdit}>
                編集取消
              </button>
            )}
          </div>

          <div style={{ marginTop: "14px", fontSize: "16px", color: "#475569", lineHeight: "1.7" }}>
            入庫CSVの見出しは <strong>棚番,品番,箱数,入庫日</strong> です。
          </div>
        </div>
      )}

      {activeTab === "shipment" && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "28px", marginTop: 0 }}>出庫登録</h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="品番"
              value={shipmentForm.partNo}
              onChange={(e) => setShipmentForm({ ...shipmentForm, partNo: e.target.value })}
              list="partnos2"
            />
            <datalist id="partnos2">
              {masters.map((m) => (
                <option key={m.id} value={m.partNo}>{m.partName}</option>
              ))}
            </datalist>
            <button style={primaryButtonStyle} onClick={previewShipmentAction}>
              最古棚番を確認
            </button>
          </div>

          {shipmentPreview && (
            <div style={highlightCardStyle}>
              <div><strong>品番:</strong> {shipmentPreview.partNo}</div>
              <div><strong>品名:</strong> {shipmentPreview.partName || "（未登録）"}</div>
              <div style={{ fontSize: "30px" }}><strong>対象棚番:</strong> {shipmentPreview.shelfNo}</div>
              <div><strong>棚名:</strong> {shipmentPreview.shelfName || "（未登録）"}</div>
              <div><strong>最古入庫日:</strong> {shipmentPreview.receiptDate}</div>
              <div style={{ fontSize: "30px" }}><strong>この棚の全箱数を出庫:</strong> {shipmentPreview.boxCount} 箱</div>
              <button style={{ ...primaryButtonStyle, marginTop: "12px" }} onClick={doShipment}>
                この内容で出庫
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "stock" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>在庫一覧</h2>
            <button style={buttonStyle} onClick={exportStockCsv}>CSV出力</button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              style={{ ...inputStyle, width: "100%", maxWidth: "500px" }}
              type="text"
              placeholder="品番・品名・棚番・棚名で検索"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
          </div>

          <div style={{ ...tableWrapStyle, marginBottom: "16px" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>合計在庫箱数</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockSummary.map((s) => (
                  <tr key={s.partNo}>
                    <td style={tdStyle}>{s.partNo}</td>
                    <td style={tdStyle}>{s.total}</td>
                  </tr>
                ))}
                {filteredStockSummary.length === 0 && (
                  <tr><td style={tdStyle} colSpan="2">該当データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>棚番</th>
                  <th style={thStyle}>棚名</th>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>残箱数</th>
                  <th style={thStyle}>入庫日</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockList.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.shelfNo}</td>
                    <td style={tdStyle}>{getShelfName(r.shelfNo)}</td>
                    <td style={tdStyle}>{r.partNo}</td>
                    <td style={tdStyle}>{getPartName(r.partNo)}</td>
                    <td style={tdStyle}>{r.remaining}</td>
                    <td style={tdStyle}>{r.receiptDate}</td>
                  </tr>
                ))}
                {filteredStockList.length === 0 && (
                  <tr><td style={tdStyle} colSpan="6">該当データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "receiptHistory" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>入庫履歴</h2>
            <button style={buttonStyle} onClick={exportReceiptCsv}>CSV出力</button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              style={{ ...inputStyle, width: "100%", maxWidth: "500px" }}
              type="text"
              placeholder="品番・品名・棚番・棚名・入庫日で検索"
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
            />
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>棚番</th>
                  <th style={thStyle}>棚名</th>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>箱数</th>
                  <th style={thStyle}>入庫日</th>
                  <th style={thStyle}>予定由来</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.shelfNo}</td>
                    <td style={tdStyle}>{getShelfName(r.shelfNo)}</td>
                    <td style={tdStyle}>{r.partNo}</td>
                    <td style={tdStyle}>{getPartName(r.partNo)}</td>
                    <td style={tdStyle}>{r.boxCount}</td>
                    <td style={tdStyle}>{r.receiptDate}</td>
                    <td style={tdStyle}>{r.sourcePlanId ? "予定から" : ""}</td>
                    <td style={tdStyle}>
                      <button style={smallButtonStyle} onClick={() => editReceipt(r)}>編集</button>
                      <button style={smallDangerButtonStyle} onClick={() => deleteReceipt(r.id)}>削除</button>
                    </td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 && (
                  <tr><td style={tdStyle} colSpan="8">該当データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "shipmentHistory" && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "15px" }}>
            <h2 style={{ fontSize: "28px", margin: 0 }}>出庫履歴</h2>
            <button style={buttonStyle} onClick={exportShipmentCsv}>CSV出力</button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <input
              style={{ ...inputStyle, width: "100%", maxWidth: "500px" }}
              type="text"
              placeholder="品番・品名・棚番・棚名・出庫日で検索"
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
            />
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>棚番</th>
                  <th style={thStyle}>棚名</th>
                  <th style={thStyle}>出庫箱数</th>
                  <th style={thStyle}>出庫日</th>
                  <th style={thStyle}>状態</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((s) => (
                  <tr key={s.id}>
                    <td style={tdStyle}>{s.partNo}</td>
                    <td style={tdStyle}>{getPartName(s.partNo)}</td>
                    <td style={tdStyle}>{s.shelfNo}</td>
                    <td style={tdStyle}>{getShelfName(s.shelfNo)}</td>
                    <td style={tdStyle}>{s.boxCount}</td>
                    <td style={tdStyle}>{s.shipmentDate}</td>
                    <td style={tdStyle}>{s.canceled ? "取消済" : "有効"}</td>
                    <td style={tdStyle}>
                      {!s.canceled && (
                        <button style={smallButtonStyle} onClick={() => cancelShipment(s.id)}>
                          出庫取消
                        </button>
                      )}
                      <button style={smallDangerButtonStyle} onClick={() => deleteShipment(s.id)}>
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredShipments.length === 0 && (
                  <tr><td style={tdStyle} colSpan="8">該当データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "shelfHistory" && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "28px", marginTop: 0 }}>棚番別履歴</h2>
          <div style={{ marginBottom: "15px" }}>
            <input
              style={{ ...inputStyle, width: "100%", maxWidth: "500px" }}
              type="text"
              placeholder="棚番で検索"
              value={shelfSearch}
              onChange={(e) => setShelfSearch(e.target.value)}
            />
          </div>

          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>棚番</th>
                  <th style={thStyle}>棚名</th>
                  <th style={thStyle}>区分</th>
                  <th style={thStyle}>品番</th>
                  <th style={thStyle}>品名</th>
                  <th style={thStyle}>箱数</th>
                  <th style={thStyle}>日付</th>
                  <th style={thStyle}>内容</th>
                </tr>
              </thead>
              <tbody>
                {shelfHistory.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.shelfNo}</td>
                    <td style={tdStyle}>{row.shelfName}</td>
                    <td style={tdStyle}>{row.eventType}</td>
                    <td style={tdStyle}>{row.partNo}</td>
                    <td style={tdStyle}>{row.partName}</td>
                    <td style={tdStyle}>{row.qty}</td>
                    <td style={tdStyle}>{row.date}</td>
                    <td style={tdStyle}>{row.note}</td>
                  </tr>
                ))}
                {shelfHistory.length === 0 && (
                  <tr><td style={tdStyle} colSpan="8">棚番を入力すると、その棚の入出庫履歴を表示します</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
