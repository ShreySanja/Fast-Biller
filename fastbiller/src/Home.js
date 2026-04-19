import React, { useState, useRef, useEffect } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";
// wherever you're initializing Chart.js
import {
    Chart as ChartJS,
    ArcElement,
    BarElement,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    ArcElement, // for Pie / Doughnut
    BarElement,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
    Filler // for using "fill" in line charts
);



const tabs = ["Analytics", "Sales", "Receipts", "Settings"];
const chartTypes = ["line", "bar"];
const dataTypes = ["Sales", "Receipts", "Outstanding"];
const pieOptions = ["Sales by Party", "Receipts by Party", "Sales by Type"];

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
export default function Home() {
    const [selectedTab, setSelectedTab] = useState("Analytics");
    const [startDate, setStartDate] = useState(() => new Date().toISOString().substring(0, 10));
    const [endDate, setEndDate] = useState(() => new Date().toISOString().substring(0, 10));


    const [salesData, setSalesData] = useState([]);
    const [receiptsData, setReceiptsData] = useState([]);
    const [chartType, setChartType] = useState("line");
    const [dataType, setDataType] = useState("Sales");
    const [selectedPie, setSelectedPie] = useState("Sales by Party");

    // Debounced versions
    const [debouncedStartDate, setDebouncedStartDate] = useState(startDate);
    const [debouncedEndDate, setDebouncedEndDate] = useState(endDate);

    const debounceTimer = useRef(null);

    const fetchData = async () => {
        const body = JSON.stringify({});

        try {
            const salesRes = await fetch(`${API_BASE_URL}/getsalesdataforledger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            });
            const sales = await salesRes.json();
            setSalesData(Array.isArray(sales) && sales.length ? sales : []);

            const receiptsRes = await fetch(`${API_BASE_URL}/getreceiptdata`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            });
            const receipts = await receiptsRes.json();
            setReceiptsData(Array.isArray(receipts) && receipts.length ? receipts : []);
        } catch (error) {
            console.error("Error fetching data:", error);
            setSalesData([]);
            setReceiptsData([]);
        }
    };




    // Debounce the dates used for chart
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            setDebouncedStartDate(startDate);
            setDebouncedEndDate(endDate);
        }, 500); // 
    }, [startDate, endDate]);

    
    useEffect(() => {
        fetchData();
    }, []);


    const getChartData = () => {
        const dateMap = {};
        const byDay = debouncedStartDate.slice(0, 7) === debouncedEndDate.slice(0, 7); // if same month

        const formatMonth = (dateStr) => {
            const date = new Date(dateStr);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${date.getFullYear()}-${month}`; // e.g., "2025-04"
        };

        const formatDay = (dateStr) => {
            const date = new Date(dateStr);
            return date.toISOString().slice(0, 10); // "2025-04-08"
        };

        salesData.forEach(s => {
            const key = byDay ? formatDay(s.InvDate || s.Date) : formatMonth(s.InvDate || s.Date);
            if (!dateMap[key]) dateMap[key] = { sales: 0, receipts: 0 };
            dateMap[key].sales += Number(s.GrandTotal || 0);
        });

        receiptsData.forEach(r => {
            const key = byDay ? formatDay(r.receiptDate) : formatMonth(r.receiptDate);
            if (!dateMap[key]) dateMap[key] = { sales: 0, receipts: 0 };
            dateMap[key].receipts += Number(r.amount || 0);
        });

        const allLabels = [];
        const labelToKeyMap = {};

        const start = new Date(debouncedStartDate);
        const end = new Date(debouncedEndDate);

        if (byDay) {
            while (start <= end) {
                const key = start.toISOString().slice(0, 10);
                const label = key; // or custom label
                allLabels.push(label);
                labelToKeyMap[label] = key;
                start.setDate(start.getDate() + 1);
            }
        } else {
            start.setDate(1);
            while (start <= end) {
                const key = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}`;
                const label = start.toLocaleString('default', { month: 'short', year: 'numeric' });
                allLabels.push(label);
                labelToKeyMap[label] = key;
                start.setMonth(start.getMonth() + 1);
            }
        }

        const chartData = allLabels.map(label => {
            const data = dateMap[labelToKeyMap[label]] || { sales: 0, receipts: 0 };
            if (dataType === "Sales") return data.sales;
            if (dataType === "Receipts") return data.receipts;
            return data.sales - data.receipts;
        });

        return {
            labels: allLabels,
            datasets: [
                {
                    label: dataType,
                    data: chartData,
                    backgroundColor: "rgba(75, 192, 192, 0.5)",
                    borderColor: "rgba(75, 192, 192, 1)",
                    fill: chartType === "line",
                }
            ]
        };
    };



    const getPieData = () => {
        const dataMap = {};

        const isInDateRange = (dateStr) => {
            const date = new Date(dateStr);
            return (
                date >= new Date(debouncedStartDate) &&
                date <= new Date(debouncedEndDate)
            );
        };

        if (selectedPie === "Sales by Party") {
            salesData.forEach(s => {
                const date = s.InvDate || s.Date;
                if (!isInDateRange(date)) return;

                const name = s.BillToPartyName || "Unknown";
                dataMap[name] = (dataMap[name] || 0) + Number(s.GrandTotal || 0);
            });
        } else if (selectedPie === "Receipts by Party") {
            receiptsData.forEach(r => {
                const date = r.receiptDate;
                if (!isInDateRange(date)) return;

                const name = r.partyName || "Unknown";
                dataMap[name] = (dataMap[name] || 0) + Number(r.amount || 0);
            });
        } else if (selectedPie === "Sales by Type") {
            salesData.forEach(s => {
                const date = s.InvDate || s.Date;
                if (!isInDateRange(date)) return;

                const type = s.SalesType || "Unknown";
                dataMap[type] = (dataMap[type] || 0) + Number(s.GrandTotal || 0);
            });
        }

        const labels = Object.keys(dataMap);
        const values = labels.map(l => dataMap[l]);

        return {
            labels,
            datasets: [
                {
                    label: selectedPie,
                    data: values,
                    backgroundColor: labels.map((_, i) =>
                        `hsl(${(i * 360) / labels.length}, 70%, 60%)`
                    )
                }
            ]
        };
    };


    return (<>
        <style>
            {` 
                .container {
                    padding: 1.5rem;
                    max-width: 1500px;
                    margin: 0 auto;
                    background: #ffffff;
                    box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }
                h2 {
                    text-align: center;
                    font-size: 1.8rem;
                    color: #333;
                    margin-bottom: 1rem;
                    font-family: 'Roboto Slab', Arial, sans-serif;
                }

                input:hover, 
                textarea:hover{
                    border: 1px solid lightgray;
                    outline: none;
                }
 
                input:focus, 
                textarea:focus {
                    border: 1px solid blue;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1.5rem;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fff;
                    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 7px;
                    text-align: left;
                }
                th {
                    background-color: #61abff;
                    color: #fff;
                    padding: 12px;
                    text-align:center;
                    font-family: 'Roboto Slab', Arial, sans-serif;
                }
                td {
                    background-color: #f9f9f9;
                    transition: background 0.3s ease;
                }
                tr:hover td {
                    background: #f1f1f1;
                }
                .del-btn, .modify-btn {
                    cursor: pointer;
                    background: none;
                    border: none;
                    color: #dc3545;
                    font-size: 1.2rem;
                }
                .del-btn {
            color: #dc3545;
          }
          .modify-btn {
            color: #007bff;
          }
                /* Placeholder text color */
thead th input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

thead td input{
    width:100%;
    text-align: center;
    margin-left: -3px;
} 
thead tr th{
    height:30px;
}

/* to remove the up and down arrow of number input */
input[type="number"] {
    -moz-appearance: textfield; /* Firefox */
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.amount-filter {
  display: flex;
  align-items: center;
  gap: 4px;
}
.amount-filter button {
  min-width: 25px;
  padding: 2px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
}
.date-range-filter {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            align-items: center;
          }
          .date-range-filter input {
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .showBorder{
              border: 1px solid lightgray;
          }
`}
        </style>
        <div style={{ display: "flex", padding: "1rem", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        style={{
                            padding: "0.5rem 1rem",
                            background: selectedTab === tab ? "#007bff" : "#ccc",
                            color: selectedTab === tab ? "white" : "black",
                            border: "none", borderRadius: "4px", cursor:'pointer'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div style={{ flexGrow: 1, height: "83vh", padding: "1rem", border: "1px solid #ccc", borderRadius: "5px" }}>
                {selectedTab === "Analytics" && (
                    <div>
                        <h2>Analytics</h2>
                        <div>
                            <label>Business Date:</label>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <label>Start:</label>
                                <input className="showBorder" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <label>End:</label>
                                <input className="showBorder" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                <button onClick={()=>fetchData()}>Refresh</button>
                            </div>
                        </div>

                        <br /><br />

                        <div>
                            <label>Chart Type: </label>
                            <select className="showBorder"  value={chartType} onChange={e => setChartType(e.target.value)}>
                                {chartTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>

                            <label style={{ marginLeft: "1rem" }}>Data: </label>
                            <select className="showBorder"  value={dataType} onChange={e => setDataType(e.target.value)}>
                                {dataTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', padding: '1rem' }}>
                            <div style={{ width: '220mm', marginRight:'100px' }}>
                                {chartType === "line" ? (
                                    <Line data={getChartData()} />
                                ) : (
                                    <Bar data={getChartData()} />
                                )}
                            </div>
                            <div style={{ width:'100mm', padding: '1rem' }}>
                                <label>Pie Chart: </label>
                                <select className="showBorder" value={selectedPie} onChange={e => setSelectedPie(e.target.value)}>
                                    {pieOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <Pie data={getPieData()} />
                            </div>
                        </div>


                    </div>
                )}

                {selectedTab === "Sales" && <div className="container"><h2>Sales Data</h2><SalesTable /></div>}
                {selectedTab === "Receipts" && <div className="container"><h2>Receipts List</h2><ReceiptsList /></div>}
                {selectedTab === "Settings" && <div className="container"><h2>Settings</h2><SettingsTab /></div>}
            </div>
        </div>


                
                </>
    );
}

function SettingsTab() {
    // default fiscal year: 01‑Apr this year → 31‑Mar next year
    const getDefaultDates = () => {
        const y = new Date().getFullYear();
        return {
            start: { day: 1, month: 4, year: y },
            end: { day: 31, month: 3, year: y + 1 }
        };
    };

    const [businessDate, setBusinessDate] = useState(getDefaultDates());
    const [original, setOriginal] = useState(getDefaultDates());
    const [warning, setWarning] = useState("");
    const [statusMessage, setStatusMessage] = useState("Not Set");


    // Fetch from backend and normalize into { day, month, year } shape
    useEffect(() => {
        fetch(`${API_BASE_URL}/getbusinessdate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        })
            .then(r => r.json())
            .then(data => {
                if (data.businessDate?.start && data.businessDate?.end) {
                    const s = new Date(data.businessDate.start);
                    const e = new Date(data.businessDate.end);
                    const normalized = {
                        start: { day: s.getDate(), month: s.getMonth() + 1, year: s.getFullYear() },
                        end: { day: e.getDate(), month: e.getMonth() + 1, year: e.getFullYear() }
                    };
                    setBusinessDate(normalized);
                    setOriginal(normalized);
                    setStatusMessage("Set");
                }
            })
            .catch(console.error);
    }, []);

    const handleCustomDateChange = (which, field, raw) => {
        const val = Number(raw);
        // Deep clone only the segment we're editing
        const updated = {
            start: { ...businessDate.start },
            end: { ...businessDate.end },
        };
        updated[which][field] = val;

        // sync year logic
        if (which === "start" && field === "year") {
            updated.end.year = updated.start.year + 1;
        }
        if (which === "end" && field === "year") {
            updated.start.year = updated.end.year - 1;
        }

        // compare only the segment that changed
        const origSeg = original[which];
        const updSeg = updated[which];
        if (field === "day" || field === "month") {
            if (origSeg.day !== updSeg.day || origSeg.month !== updSeg.month) {
                setWarning("⚠️  Changing day or month may cause invoice‑number collisions. Proceed carefully.");
            } else {
                setWarning("");
            }
        }

        setBusinessDate(updated);
    };

    const updateDateInBackend = () => {
        setStatusMessage("Setting...");
        const fmt = (seg) =>
            `${seg.year}-${String(seg.month).padStart(2, "0")}-${String(seg.day).padStart(2, "0")}`;
        const payload = {
            start: fmt(businessDate.start),
            end: fmt(businessDate.end)
        };
        fetch(`${API_BASE_URL}/setbusinessdate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(() => {
                setTimeout(() => {
                    setStatusMessage("Set");
                }, 800);
            })
            .catch(err => {
                console.error(err);
                setStatusMessage("❌ Error");
            });
    };


    return (
        <>
            <style>{`
        .settings { font-family: sans-serif; max-width: 360px; }
        .row { display: flex; align-items: center; margin-bottom: 8px; }
        .row label { width: 80px; font-weight: bold; }
        .row input { width: 50px; text-align: center; margin: 0 4px; }
        .warning { color: #c00; margin: 8px 0; font-size: 0.9em; }
        .btn { margin-left: 0px;}
      `}</style>

            <div className="settings">
                <h3>Business Date</h3>

                <div className="row">
                    <label>Start:</label>
                    <input
                        type="number"
                        min={1} max={31}
                        value={String(businessDate.start.day).padStart(2, "0")}
                        onChange={e => handleCustomDateChange("start", "day", e.target.value)}
                    />
                    /
                    <input
                        type="number"
                        min={1} max={12}
                        value={String(businessDate.start.month).padStart(2, "0")}
                        onChange={e => handleCustomDateChange("start", "month", e.target.value)}
                    />
                    /
                    <input
                        type="number"
                        value={businessDate.start.year}
                        onChange={e => handleCustomDateChange("start", "year", e.target.value)}
                    />
                </div>

                <div className="row">
                    <label>End:</label>
                    <input
                        type="number"
                        min={1} max={31}
                        value={String(businessDate.end.day).padStart(2, "0")}
                        onChange={e => handleCustomDateChange("end", "day", e.target.value)}
                    />
                    /
                    <input
                        type="number"
                        min={1} max={12}
                        value={String(businessDate.end.month).padStart(2, "0")}
                        onChange={e => handleCustomDateChange("end", "month", e.target.value)}
                    />
                    /
                    <input
                        type="number"
                        value={businessDate.end.year}
                        onChange={e => handleCustomDateChange("end", "year", e.target.value)}
                    />
                </div>

                {warning && <div className="warning">{warning}</div>}
                <br/>
                <div style={{ marginTop: 10, fontStyle: "italic", color:"gray"}}>
                    Status: {statusMessage}
                </div>

                <button className="btn" onClick={updateDateInBackend}>
                    Update
                </button>
            </div>
        </>
    );
}


function ReceiptsList() {
    // State for receipts and filters
    const navigate = useNavigate();
    const [receipts, setReceipts] = useState([]);
    const [filters, setFilters] = useState({
        receiptNo: "",
        receiptDate: "",
        partyName: "",
        amount: "",
        amountOperator: "=",
        narration: ""
    });
    const [dateRange, setDateRange] = useState({
        from: "",
        to: ""
    });
    const handleDateRangeChange = (key, value) => {
        setDateRange(prev => ({ ...prev, [key]: value }));
    };
    const toggleOperator = (field) => {
        setFilters(prev => ({
            ...prev,
            [`${field}Operator`]: prev[`${field}Operator`] === "=" ? "<" :
                prev[`${field}Operator`] === "<" ? ">" : "="
        }));
    };

    // Fetch receipts on component mount
    useEffect(() => {
        const fetchReceipts = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/getreceiptdata`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });

                if (!response.ok) throw new Error("Failed to fetch receipt data");
                const data = await response.json();
                setReceipts(data);
            } catch (error) {
                console.error("Error fetching receipts:", error);
            }
        };

        fetchReceipts();
    }, []);

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Filter receipts based on filter values
    const filteredReceipts = receipts.filter(receipt => {
        // Date range filtering
        const receiptDate = new Date(receipt.receiptDate);
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;

        const dateInRange =
            (!fromDate || receiptDate >= fromDate) &&
            (!toDate || receiptDate <= toDate);

        // Numeric comparison function
        const compareAmount = (value, filterValue, operator) => {
            if (!filterValue) return true;
            const numValue = parseFloat(value || 0);
            const numFilter = parseFloat(filterValue);

            switch (operator) {
                case "<": return numValue < numFilter;
                case ">": return numValue > numFilter;
                default: return Math.abs(numValue - numFilter) < 0.01; // precision tolerance
            }
        };

        return (
            dateInRange &&
            // Text filters
            (filters.receiptNo ? receipt.receiptNo.toString().includes(filters.receiptNo) : true) &&
            (filters.receiptDate ? receipt.receiptDate.includes(filters.receiptDate) : true) &&
            (filters.partyName ? receipt.partyName.toLowerCase().includes(filters.partyName.toLowerCase()) : true) &&
            (filters.narration ? receipt.narration.toLowerCase().includes(filters.narration.toLowerCase()) : true) &&
            // Numeric filter
            compareAmount(receipt.amount, filters.amount, filters.amountOperator)
        );
    });


    // Delete a receipt
    const editReceipt = async (id) => {
        try {
            navigate(`/create-receipt?id=${id}`);
        } catch (error) {
            console.error("Error navigating to edit receipt:", error);
        }
    };

    // Delete a receipt
    const deleteReceipt = async (id) => {
        try {
            await fetch(`${API_BASE_URL}/delete-receipt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });

            // Remove from local state
            setReceipts(prev => prev.filter(r => r._id !== id));
        } catch (error) {
            console.error("Error deleting receipt:", error);
        }
    };

    return (
        <div className="container">
            <div className="date-range-filter">
                    <span>From:</span>
                    <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => handleDateRangeChange("from", e.target.value)}
                        style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <span>To:</span>
                    <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => handleDateRangeChange("to", e.target.value)}
                        style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>
            <table>
                <thead>
                    <tr>
                        <th>Receipt No</th>
                        <th>Date</th>
                        <th>Party Name</th>
                        <th>Amount</th>
                        <th style={{ minWidth: '300px' }}>Narration</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <thead>
                    <tr>
                        <td><input type="number" placeholder="Filter" value={filters.receiptNo} onChange={(e) => handleFilterChange("receiptNo", e.target.value)} /></td>
                        <td><input type="text" placeholder="Filter" value={filters.receiptDate} onChange={(e) => handleFilterChange("receiptDate", e.target.value)} /></td>
                        <td><input type="text" placeholder="Filter" value={filters.partyName} onChange={(e) => handleFilterChange("partyName", e.target.value)} /></td>
                        <td>
                            <div className="amount-filter">
                                <button onClick={() => toggleOperator("amount")}>{filters.amountOperator}</button>
                                <input type="number" placeholder="Filter" value={filters.amount} onChange={(e) => handleFilterChange("amount", e.target.value)} />
                            </div>
                        </td>
                        <td><input type="text" placeholder="Filter" value={filters.narration} onChange={(e) => handleFilterChange("narration", e.target.value)} style={{ minWidth: '300px', marginRight: '-60px' }} /></td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {filteredReceipts.length > 0 ? (
                        filteredReceipts.map(receipt => (
                            <tr key={receipt._id.$oid}>
                                <td>{receipt.receiptNo}</td>
                                <td>{receipt.receiptDate.split('-').reverse().join('-')}</td>
                                <td>{receipt.partyName}</td>
                                <td style={{ textAlign: "right" }}>{receipt.amount.toFixed(2)}</td>
                                <td style={{ width: '300px' }}>{receipt.narration}</td>
                                <td style={{ textAlign: "center" }}>
                                    <button className="modify-btn" onClick={() => editReceipt(receipt._id)}>✏️</button>
                                    <button className="del-btn" onClick={() => deleteReceipt(receipt._id)}>🗑️</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6" style={{ textAlign: "center" }}>No Receipts Found</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// Add this component somewhere in your file
function SalesTable() {
    const navigate = useNavigate();

    const [sales, setSales] = useState([]);
    const [filters, setFilters] = useState({
        invNo: "",
        invDate: "",
        billToPartyName: "",
        billToGSTIN: "",
        salesType: "",
        taxableAmt: "",
        taxableAmtOperator: "=",
        cgst: "",
        cgstOperator: "=",
        sgst: "",
        sgstOperator: "=",
        igst: "",
        igstOperator: "=",
        grandTotal: "",
        grandTotalOperator: "=",
        memoType: "",
        invoiceType: "",
        shipToPartyName: "",
        shipToGSTIN: "",
        billToState: "",
        shipToState: "",
        totalTax: "",
        totalTaxOperator: "=",
        discountPer: "",
        discountPerOperator: "=",
        discountRs: "",
        discountRsOperator: "=",
        pkgCharge: "",
        pkgChargeOperator: "="
    });

    
    const [dateRange, setDateRange] = useState({
        from: "",
        to: ""
    });
    const [showSettings, setShowSettings] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        memoType: false,
        invoiceType: false,
        shipToPartyName: false,
        shipToGSTIN: false,
        billToState: false,
        shipToState: false,
        totalTax: false,
        discountPer: false,
        discountRs: false,
        pkgCharge: false
    });

    useEffect(() => {
        const fetchSales = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/getsalesdataforledger`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                setSales(Array.isArray(data) ? data : []); // Ensure data is array
            } catch (error) {
                console.error("Error fetching sales data:", error);
                setSales([]); // Set to empty array on error
            }
        };

        fetchSales();
    }, []);


    const editSales = async (id) => {
        try {
            navigate(`/create-bill/layout1?id=${id}`);
        } catch (error) {
            console.error("Error navigating to edit receipt:", error);
        }
    };

    // Add these toggle functions
    const toggleOperator = (field) => {
        setFilters(prev => ({
            ...prev,
            [`${field}Operator`]: prev[`${field}Operator`] === "=" ? "<" :
                prev[`${field}Operator`] === "<" ? ">" : "="
        }));
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleDateRangeChange = (key, value) => {
        setDateRange(prev => ({ ...prev, [key]: value }));
    };

    const toggleColumnVisibility = (column) => {
        setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
    };

    const filteredSales = sales.filter(sale => {
        // Date range filtering
        const invDate = new Date(sale.InvDate);
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;

        const dateInRange =
            (!fromDate || invDate >= fromDate) &&
            (!toDate || invDate <= toDate);

        // Numeric comparison function
        const compareAmount = (value, filterValue, operator) => {
            if (!filterValue) return true;
            const numValue = parseFloat(value || 0);
            const numFilter = parseFloat(filterValue);

            switch (operator) {
                case "<": return numValue < numFilter;
                case ">": return numValue > numFilter;
                default: return Math.abs(numValue - numFilter) < 0.01; // Account for floating point precision
            }
        };

        // Calculate tax values for comparison
        const cgstValue = sale.SalesType === "Local Sales" ? sale.TotalTax / 2 : 0;
        const sgstValue = sale.SalesType === "Local Sales" ? sale.TotalTax / 2 : 0;
        const igstValue = sale.SalesType === "Central Sales" ? sale.TotalTax : 0;

        return (
            dateInRange &&
            // Text filters
            (filters.invNo ? sale.InvNo.toString().toLowerCase().includes(filters.invNo.toLowerCase()) : true) &&
            (filters.invDate ? sale.InvDate.includes(filters.invDate) : true) &&
            (filters.billToPartyName ? (sale.BillToPartyName || "").toLowerCase().includes(filters.billToPartyName.toLowerCase()) : true) &&
            (filters.billToGSTIN ? (sale.BillToAddressDetails?.GSTIN || "").toLowerCase().includes(filters.billToGSTIN.toLowerCase()) : true) &&
            (filters.salesType ? sale.SalesType.toLowerCase().includes(filters.salesType.toLowerCase()) : true) &&
            (filters.memoType ? (sale.MemoType || "").toLowerCase().includes(filters.memoType.toLowerCase()) : true) &&
            (filters.invoiceType ? (sale.InvType || "").toLowerCase().includes(filters.invoiceType.toLowerCase()) : true) &&
            (filters.shipToPartyName ? (sale.ShipToPartyName || "").toLowerCase().includes(filters.shipToPartyName.toLowerCase()) : true) &&
            (filters.shipToGSTIN ? (sale.ShipToAddressDetails?.GSTIN || "").toLowerCase().includes(filters.shipToGSTIN.toLowerCase()) : true) &&
            (filters.billToState ? (sale.BillToAddressDetails?.PartyStateAndCode || "").toLowerCase().includes(filters.billToState.toLowerCase()) : true) &&
            (filters.shipToState ? (sale.ShipToAddressDetails?.PartyStateAndCode || "").toLowerCase().includes(filters.shipToState.toLowerCase()) : true) &&

            // Numeric filters with operators
            compareAmount(sale.TaxableVal, filters.taxableAmt, filters.taxableAmtOperator) &&
            compareAmount(cgstValue, filters.cgst, filters.cgstOperator) &&
            compareAmount(sgstValue, filters.sgst, filters.sgstOperator) &&
            compareAmount(igstValue, filters.igst, filters.igstOperator) &&
            compareAmount(sale.GrandTotal, filters.grandTotal, filters.grandTotalOperator) &&
            compareAmount(sale.TotalTax, filters.totalTax, filters.totalTaxOperator) &&
            compareAmount(sale.DiscountPer, filters.discountPer, filters.discountPerOperator) &&
            compareAmount(sale.DiscountRs, filters.discountRs, filters.discountRsOperator) &&
            compareAmount(sale.PackagingCharge, filters.pkgCharge, filters.pkgChargeOperator)
        );
    });

    const deleteSale = async (id) => {
        try {
            await fetch(`${API_BASE_URL}/deletesale`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id })
            });

            setSales(prev => prev.filter(s => s._id !== id));
        } catch (error) {
            console.error("Error deleting sale:", error);
        }
    };

    return (
        <>
            <style>
                {`

          .container {
            padding: 1.5rem;
            max-width: 1500px;
            margin: 0 auto;
            background: #ffffff;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
            border-radius: 10px;
          }
          h2 {
            text-align: center;
            font-size: 1.8rem;
            color: #333;
            margin-bottom: 1rem;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1.5rem;
            border-radius: 8px;
            overflow: hidden;
            background: #fff;
            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
          }
          th, td {
            border: 1px solid #ddd;
            padding: 7px;
            text-align: left;
            font-size: 14px;
          }
          th{
              text-align:center;
          }
          
          .settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 15px 0;
}

.settings-option {
  display: flex;
  align-items: center;
}

.settings-option input {
  margin-right: 8px;
}

.close-settings {
  background: #61abff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.settings-button {
  background: none;
  border: none;
  font-size: 20px   ;
  cursor: pointer;
  margin-left: 10px;
}
        `}
            </style>

            <div className="container">
                <div className="date-range-filter">
                    <span>From:</span>
                    <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => handleDateRangeChange("from", e.target.value)}
                        style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <span>To:</span>
                    <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => handleDateRangeChange("to", e.target.value)}
                        style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                    <button
                        style={{
                            marginTop: '-5px',
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            marginLeft: '10px',
                            color: '#61abff',
                            padding: '5px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onClick={() => setShowSettings(true)}
                        title="Column Settings"
                    >
                        ⚙️
                    </button>
                </div>

                {showSettings && (
                    <div className="settings-overlay" onClick={() => setShowSettings(false)}>
                        <div className="settings-content" onClick={e => e.stopPropagation()}>
                            <h3>Show/Hide Columns</h3>
                            <div className="settings-grid">
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="memoType"
                                        checked={visibleColumns.memoType}
                                        onChange={() => toggleColumnVisibility('memoType')}
                                    />
                                    <label htmlFor="memoType">Memo Type</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="invoiceType"
                                        checked={visibleColumns.invoiceType}
                                        onChange={() => toggleColumnVisibility('invoiceType')}
                                    />
                                    <label htmlFor="invoiceType">Invoice Type</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="shipToPartyName"
                                        checked={visibleColumns.shipToPartyName}
                                        onChange={() => toggleColumnVisibility('shipToPartyName')}
                                    />
                                    <label htmlFor="shipToPartyName">ShipTo Party Name</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="shipToGSTIN"
                                        checked={visibleColumns.shipToGSTIN}
                                        onChange={() => toggleColumnVisibility('shipToGSTIN')}
                                    />
                                    <label htmlFor="shipToGSTIN">ShipTo GSTIN</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="billToState"
                                        checked={visibleColumns.billToState}
                                        onChange={() => toggleColumnVisibility('billToState')}
                                    />
                                    <label htmlFor="billToState">BillTo State</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="shipToState"
                                        checked={visibleColumns.shipToState}
                                        onChange={() => toggleColumnVisibility('shipToState')}
                                    />
                                    <label htmlFor="shipToState">ShipTo State</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="totalTax"
                                        checked={visibleColumns.totalTax}
                                        onChange={() => toggleColumnVisibility('totalTax')}
                                    />
                                    <label htmlFor="totalTax">Total Tax</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="discountPer"
                                        checked={visibleColumns.discountPer}
                                        onChange={() => toggleColumnVisibility('discountPer')}
                                    />
                                    <label htmlFor="discountPer">Discount %</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="discountRs"
                                        checked={visibleColumns.discountRs}
                                        onChange={() => toggleColumnVisibility('discountRs')}
                                    />
                                    <label htmlFor="discountRs">Discount Rs</label>
                                </div>
                                <div className="settings-option">
                                    <input
                                        type="checkbox"
                                        id="pkgCharge"
                                        checked={visibleColumns.pkgCharge}
                                        onChange={() => toggleColumnVisibility('pkgCharge')}
                                    />
                                    <label htmlFor="pkgCharge">Packaging Charge</label>
                                </div>
                            </div>
                            <button
                                className="close-settings"
                                onClick={() => setShowSettings(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}

                <table>
                    <thead>
                        <tr>
                            <th style={{width:'35px'} }>Sr No.</th>
                            <th>Invoice No</th>
                            <th>Inv Date</th>
                            <th>BillTo Party</th>
                            <th>BillTo GSTIN</th>
                            <th>Sales Type</th>
                            <th>Taxable Amt</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>IGST</th>
                            <th>Grand Total</th>

                            {/* Hidden columns that can be shown via settings */}
                            {visibleColumns.memoType && <th>Memo Type</th>}
                            {visibleColumns.invoiceType && <th>Invoice Type</th>}
                            {visibleColumns.shipToPartyName && <th>ShipTo Party</th>}
                            {visibleColumns.shipToGSTIN && <th>ShipTo GSTIN</th>}
                            {visibleColumns.billToState && <th>BillTo State</th>}
                            {visibleColumns.shipToState && <th>ShipTo State</th>}
                            {visibleColumns.totalTax && <th>Total Tax</th>}
                            {visibleColumns.discountPer && <th>Discount %</th>}
                            {visibleColumns.discountRs && <th>Discount Rs</th>}
                            {visibleColumns.pkgCharge && <th>Pkg Charge</th>}

                            <th>Actions</th>
                        </tr>
                    </thead>
                    <thead>
                        <tr>
                            <td style={{ width: '35px' }}></td>
                            <td><input type="text" placeholder="Filter" value={filters.invNo} onChange={(e) => handleFilterChange("invNo", e.target.value)} /></td>
                            <td><input type="text" placeholder="Filter" value={filters.invDate} onChange={(e) => handleFilterChange("invDate", e.target.value)} /></td>
                            <td><input type="text" placeholder="Filter" value={filters.billToPartyName} onChange={(e) => handleFilterChange("billToPartyName", e.target.value)} /></td>
                            <td><input type="text" placeholder="Filter" value={filters.billToGSTIN} onChange={(e) => handleFilterChange("billToGSTIN", e.target.value)} /></td>
                            <td><input type="text" placeholder="Filter" value={filters.salesType} onChange={(e) => handleFilterChange("salesType", e.target.value)} /></td>
                            <td>
                                <div className="amount-filter">
                                    <button onClick={() => toggleOperator("taxableAmt")}>{filters.taxableAmtOperator}</button>
                                    <input type="number" placeholder="Filter" value={filters.taxableAmt} onChange={(e) => handleFilterChange("taxableAmt", e.target.value)} />
                                </div>
                            </td>
                            <td>
                                <div className="amount-filter">
                                    <button onClick={() => toggleOperator("cgst")}>{filters.cgstOperator}</button>
                                    <input type="number" placeholder="Filter" value={filters.cgst} onChange={(e) => handleFilterChange("cgst", e.target.value)} />
                                </div>
                            </td>
                            <td>
                                <div className="amount-filter">
                                    <button onClick={() => toggleOperator("sgst")}>{filters.sgstOperator}</button>
                                    <input type="number" placeholder="Filter" value={filters.sgst} onChange={(e) => handleFilterChange("sgst", e.target.value)} />
                                </div>
                            </td>
                            <td>
                                <div className="amount-filter">
                                    <button onClick={() => toggleOperator("igst")}>{filters.igstOperator}</button>
                                    <input type="number" placeholder="Filter" value={filters.igst} onChange={(e) => handleFilterChange("igst", e.target.value)} />
                                </div>
                            </td>
                            <td>
                                <div className="amount-filter">
                                    <button onClick={() => toggleOperator("grandTotal")}>{filters.grandTotalOperator}</button>
                                    <input type="number" placeholder="Filter" value={filters.grandTotal} onChange={(e) => handleFilterChange("grandTotal", e.target.value)} />
                                </div>
                            </td>

                            {/* Filters for hidden columns */}
                            {visibleColumns.memoType && <td><input type="text" placeholder="Filter" value={filters.memoType} onChange={(e) => handleFilterChange("memoType", e.target.value)} /></td>}
                            {visibleColumns.invoiceType && <td><input type="text" placeholder="Filter" value={filters.invoiceType} onChange={(e) => handleFilterChange("invoiceType", e.target.value)} /></td>}
                            {visibleColumns.shipToPartyName && <td><input type="text" placeholder="Filter" value={filters.shipToPartyName} onChange={(e) => handleFilterChange("shipToPartyName", e.target.value)} /></td>}
                            {visibleColumns.shipToGSTIN && <td><input type="text" placeholder="Filter" value={filters.shipToGSTIN} onChange={(e) => handleFilterChange("shipToGSTIN", e.target.value)} /></td>}
                            {visibleColumns.billToState && <td><input type="text" placeholder="Filter" value={filters.billToState} onChange={(e) => handleFilterChange("billToState", e.target.value)} /></td>}
                            {visibleColumns.shipToState && <td><input type="text" placeholder="Filter" value={filters.shipToState} onChange={(e) => handleFilterChange("shipToState", e.target.value)} /></td>}
                            {visibleColumns.totalTax &&
                                <td>
                                    <div className="amount-filter">
                                        <button onClick={() => toggleOperator("totalTax")}>{filters.totalTaxOperator}</button>
                                        <input type="number" placeholder="Filter" value={filters.totalTax} onChange={(e) => handleFilterChange("totalTax", e.target.value)} />
                                    </div>
                                </td>
                            }
                            {visibleColumns.discountPer &&
                                <td>
                                    <div className="amount-filter">
                                        <button onClick={() => toggleOperator("discountPer")}>{filters.discountPerOperator}</button>
                                        <input type="number" placeholder="Filter" value={filters.discountPer} onChange={(e) => handleFilterChange("discountPer", e.target.value)} />
                                    </div>
                                </td>
                            }
                            {visibleColumns.discountRs &&
                                <td>
                                    <div className="amount-filter">
                                        <button onClick={() => toggleOperator("discountRs")}>{filters.discountRsOperator}</button>
                                        <input type="number" placeholder="Filter" value={filters.discountRs} onChange={(e) => handleFilterChange("discountRs", e.target.value)} />
                                    </div>
                                </td>
                            }
                            {visibleColumns.pkgCharge &&
                                <td>
                                    <div className="amount-filter">
                                        <button onClick={() => toggleOperator("pkgCharge")}>{filters.pkgChargeOperator}</button>
                                        <input type="number" placeholder="Filter" value={filters.pkgCharge} onChange={(e) => handleFilterChange("pkgCharge", e.target.value)} />
                                    </div>
                                </td>
                            }

                            <td></td>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSales.length > 0 ? (
                            filteredSales.map((sale, index) => (
                                <tr key={sale._id.$oid}>
                                    <td style={{ width: '35px' }}>{index + 1}</td>
                                    <td>{sale.InvNo}</td>
                                    <td>{sale.InvDate.split('-').reverse().join('-')}</td>
                                    <td>{sale.BillToPartyName}</td>
                                    <td>{sale.BillToAddressDetails?.GSTIN || ""}</td>
                                    <td>{sale.SalesType}</td>
                                    <td style={{ textAlign:"right" }}>{sale.TaxableVal}</td>
                                    <td style={{ textAlign: "right" }}>
                                        {sale.SalesType === "Local Sales"
                                            ? (sale.TotalTax / 2).toFixed(2)
                                            : ""}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {sale.SalesType === "Local Sales"
                                            ? (sale.TotalTax / 2).toFixed(2)
                                            : ""}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {sale.SalesType === "Central Sales"
                                            ? sale.TotalTax
                                            : ""}
                                    </td>
                                    <td style={{ textAlign: "right" }}>{sale.GrandTotal.toFixed(2)}</td>

                                    {/* Hidden columns data */}
                                    {visibleColumns.memoType && <td>{sale.MemoType}</td>}
                                    {visibleColumns.invoiceType && <td>{sale.InvType}</td>}
                                    {visibleColumns.shipToPartyName && <td>{sale.ShipToPartyName}</td>}
                                    {visibleColumns.shipToGSTIN && <td>{sale.ShipToAddressDetails?.GSTIN || ""}</td>}
                                    {visibleColumns.billToState && <td>{sale.BillToAddressDetails?.PartyStateAndCode || ""}</td>}
                                    {visibleColumns.shipToState && <td>{sale.ShipToAddressDetails?.PartyStateAndCode || ""}</td>}
                                    {visibleColumns.totalTax && <td style={{ textAlign: "right" }}>{sale.TotalTax}</td>}
                                    {visibleColumns.discountPer && <td>{sale.DiscountPer}</td>}
                                    {visibleColumns.discountRs && <td style={{ textAlign: "right" }}>{sale.DiscountRs}</td>}
                                    {visibleColumns.pkgCharge && <td style={{ textAlign: "right" }}>{sale.PackagingCharge}</td>}

                                    <td style={{ textAlign: "center" }}>
                                        <button className="modify-btn" onClick={() => editSales(sale._id)}>✏️</button>
                                        <button className="del-btn" onClick={() => deleteSale(sale._id)}>🗑️</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={12 + Object.values(visibleColumns).filter(v => v).length} style={{ textAlign: "center" }}>
                                    No Sales Found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showSettings && (
                <div className="settings-overlay" onClick={() => setShowSettings(false)}>
                    <div className="settings-content" onClick={e => e.stopPropagation()}>
                        <h3>View Columns</h3>
                        {Object.entries(visibleColumns).map(([key, value]) => (
                            <div key={key} className="settings-option">
                                <input
                                    type="checkbox"
                                    id={key}
                                    checked={value}
                                    onChange={() => toggleColumnVisibility(key)}
                                />
                                <label htmlFor={key}>
                                    {key.split(/(?=[A-Z])/).join(" ")}
                                </label>
                            </div>
                        ))}
                        <br/>
                        <button onClick={() => setShowSettings(false)}>Close</button>
                    </div>
                </div>
            )}
        </>
    );
}