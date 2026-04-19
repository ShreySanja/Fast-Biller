import React from "react";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function CreateReceipt() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [receiptNo, setReceiptNo] = useState("");
    const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
    const [partyName, setPartyName] = useState("");
    const [amount, setAmount] = useState("");
    const [narration, setNarration] = useState("");
    const [partyList, setPartyList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAdjustment, setAdjustment] = useState(false);
    const [saveText, setSaveText] = useState("Save");
    const [progress, setProgress] = useState(0);
    const [receiptNumbers, setReceiptNumbers] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    // Get `id` from URL query param
    const searchParams = new URLSearchParams(location.search);
    const receiptId = searchParams.get("id");

    // Load receipt if ID is passed in URL
    useEffect(() => {
        if (receiptId) {
            fetchReceipt(receiptId);
        }
    }, [receiptId]);

    // Fetch receipt data
    const fetchReceipt = async (id) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/getreceiptdata`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: id }), // send plain string, backend will convert it
            });
            const data = await res.json();

            if (data && data.length > 0) {
                const r = data[0];
                setReceiptNo(r.receiptNo);
                setReceiptDate(r.receiptDate);
                setPartyName(r.partyName);
                setAmount(r.amount);
                setNarration(r.narration || "");
                setAdjustment(r.isAdjustment || false);
            }
        } catch (err) {
            console.error("Error loading receipt:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval;
        if (loading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => (prev < 90 ? prev + 2 : prev));
            }, 100);
        } else if (!loading && progress > 0) {
            setProgress(100);
            setTimeout(() => setProgress(0), 500);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const saveReceipt = async () => {
        setSaveText("Saving...");

        if (!receiptId && receiptNumbers.includes(parseInt(receiptNo))) {
            alert("Receipt with this number already exists!");
            setSaveText("Save");
            return;
        }

        if (!partyList.includes(partyName)) {
            alert("Invalid party! Please select from the list");
            setSaveText("Save");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/save-receipt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    _id: receiptId, // include the ID if editing
                    receiptNo,
                    receiptDate,
                    partyName,
                    amount,
                    narration,
                    isAdjustment
                })
            });

            if (response.ok) {
                window.location.reload();
                setSaveText("Saved!");
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to save receipt");
            }
        } catch (err) {
            console.error("Error saving receipt:", err);
            alert(`Error: ${err.message}`);
            setSaveText("Failed!");
        } finally {
            setLoading(false);
            setTimeout(() => setSaveText("Save"), 3000);
        }
    };

    // Fetch receipt numbers and party list on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/getreceiptdata`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });

                if (!response.ok) throw new Error("Failed to fetch receipt data");

                const receipts = await response.json();
                const receiptNums = receipts.map(r => parseInt(r.receiptNo, 10)).filter(n => !isNaN(n));

                // Set all receipt numbers & auto-generate next number
                setReceiptNumbers(receiptNums);
                setReceiptNo(receiptNums.length > 0 ? (Math.max(...receiptNums) + 1).toString() : "1");

                // Fetch party list
                const partyResponse = await fetch(`${API_BASE_URL}/getpartydata`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                });

                if (!partyResponse.ok) throw new Error("Failed to fetch party data");

                const parties = await partyResponse.json();
                setPartyList(parties.map(p => p.PartyName)); // Extract only names

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="container">
            <div style={{ paddingRight: '20px', paddingLeft:'5px' }}>
            <h2>Create Receipt</h2>
            <input type="text" placeholder="Receipt No." value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
            <input type="date" placeholder="Receipt Date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            <input list="partyNames" placeholder="Party Name" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
                <datalist id="partyNames">
                    {partyList.map((name, index) => (
                        <option key={index} value={name} />
                    ))}
                </datalist>
                <input
                    type="number"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setAmount(value < 0 ? 0 : value); // Ensure amount is never negative
                    }}
                />

                <textarea style={{ maxWidth: '475px', minWidth: '475px' } } placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: '10px 0',
                    padding: '0 10px'  // Adjust this if needed
                }}>
                    <input
                        type="checkbox"
                        id="adjustmentCheckbox"
                        checked={isAdjustment}
                        onChange={(e) => setAdjustment(e.target.checked)}
                        style={{
                            margin: 0,
                            width: '16px',  // Explicit width
                            height: '16px'  // Explicit height
                        }}
                    />
                    <label
                        htmlFor="adjustmentCheckbox"
                        style={{
                            margin: 0,
                            fontSize: '14px',  // Match your other text
                            userSelect: 'none'  // Prevent text selection
                        }}
                    >
                        Adjustment
                    </label>
                </div>

            <div className="button-group">
                    <button className="cancel" onClick={() => navigate("/")}>Cancel</button>
                    <button className="save" onClick={saveReceipt} style={{ marginRight: '-15px' }}>
                        {saveText}
                    </button>
            </div>

            {progress > 0 && (
                <div className="progress-overlay">
                    <span className="rotating-settings">⚙️</span>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .container {
                    max-width: 500px;
                    margin: 20px auto;
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }
                h2{
                    font-family: 'Roboto Slab', Arial, sans-serif;
                    text-align:center;
                }
                input, textarea {
                    width: 100%;
                    padding: 8px;
                    margin: 10px 0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                .button-group {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                }
                .cancel {
                    background: #ff4d4d;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .save {
                    background: #61abff;
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .progress-overlay {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.9);
                    padding: 10px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
                    font-size: 24px;
                    z-index: 1000;
                    width: 150px;
                    text-align:center;
                }
                .rotating-settings {
                    display: inline-block;
                    animation: rotate 1s linear infinite;
                }
                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .progress-bar {
                    width: 100%;
                    height: 6px;
                    background: #e0e0e0;
                    border-radius: 3px;
                    overflow: hidden;
                    margin-top: 8px;
                }
                .progress-fill {
                    height: 100%;
                    background: #4caf50;
                    transition: width 0.2s ease-in-out;
                }
            `}</style>
            </div>
        </div>
    );
}