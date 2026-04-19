import React, { useState, useEffect, useMemo } from "react";
import PrintBtn from "./PrintBtn";

export default function PartyLedger() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [parties, setParties] = useState([]);
    const [partySpecificData, setPartySpecificData] = useState([]);
    const [selectedParty, setSelectedParty] = useState("");
    const [selectedPartyName, setSelectedPartyName] = useState("");
    const [ledgerData, setLedgerData] = useState([]);
    const [dateRange, setDateRange] = useState({
        from: "",
        to: ""
    });

    // Filter data by party first (synchronously)
    useEffect(() => {
        if (selectedParty) {
            const filtered = ledgerData.filter(entry => entry.partyId === selectedParty.id);
            setPartySpecificData(filtered);

            // Calculate and set dates immediately
            if (filtered.length > 0) {
                const dates = filtered.map(entry => new Date(entry.date));
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));

                setDateRange({
                    from: minDate.toISOString().split('T')[0],
                    to: maxDate.toISOString().split('T')[0]
                });
            } else {
                setDateRange({ from: "", to: "" });
            }
        } else {
            setPartySpecificData(ledgerData);

            // For "All Parties", use full date range
            if (ledgerData.length > 0) {
                const dates = ledgerData.map(entry => new Date(entry.date));
                const minDate = new Date(Math.min(...dates));
                const maxDate = new Date(Math.max(...dates));

                setDateRange({
                    from: minDate.toISOString().split('T')[0],
                    to: maxDate.toISOString().split('T')[0]
                });
            }
        }
    }, [selectedParty, ledgerData]);

    const filteredLedgerData = useMemo(() => {
        return ledgerData.filter(entry => {
            const entryDate = new Date(entry.date);
            if (dateRange.from && entryDate < new Date(dateRange.from)) return false;
            if (dateRange.to && entryDate > new Date(dateRange.to)) return false;
            return true;
        });
    }, [ledgerData, dateRange]);

    useEffect(() => {
        const fetchParties = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/getpartydata`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({}) // Sending an empty body if no filters are needed
                });

                const data = await response.json();
                console.log("Party Data:- ", data);

                // Check if the data is valid (array and not empty)
                setParties(Array.isArray(data) && data.length ? data : []);
            } catch (error) {
                console.error("Error fetching parties:", error);
                setParties([]); // Set to empty array in case of error
            }
        };
        fetchParties();
    }, []);



    // Fetch ledger data when party or date range changes
    useEffect(() => {
        if (selectedParty) {
            fetchLedgerData();
        }
    }, [selectedParty]);

    const fetchLedgerData = async () => {
        try {
            const party = parties.find(p => p._id === selectedParty);
            // Fetch sales data for the selected party
            const salesResponse = await fetch(`${API_BASE_URL}/getsalesdataforledger`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: party?._id || ''
                })
            });
            const salesData = await salesResponse.json();
            console.log(salesData);
            // Fetch receipts data for the selected party
            
            const receiptsResponse = await fetch(`${API_BASE_URL}/getreceiptdata`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ partyName: party?.PartyName }) // Use optional chaining to avoid errors
            });
            const receiptsData = await receiptsResponse.json();

            // Process and combine data
            const processedData = processLedgerData(salesData, receiptsData);
            setLedgerData(processedData);
        } catch (error) {
            console.error("Error fetching ledger data:", error);
        }
    };


    const processLedgerData = (sales, receipts) => {
        // Process sales data
        const salesEntries = sales.map(sale => ({
            date: new Date(sale.InvDate),
            type: "Sales",
            drAmount: sale.GrandTotal,
            crAmount: 0,
            narration: `Bill No. ${sale.InvNo}`,
            isAdjustment: false
        }));

        // Process receipts data
        const receiptEntries = receipts.map(receipt => ({
            date: new Date(receipt.receiptDate),
            type: receipt.isAdjustment ? "Adjustment" : "Receipt",
            drAmount: 0,
            crAmount: receipt.amount,
            narration: receipt.narration,
            isAdjustment: receipt.isAdjustment
        }));

        // Combine and sort by date
        const combined = [...salesEntries, ...receiptEntries].sort((a, b) => a.date - b.date);

        return combined;
    };

    const calculateTotals = () => {
        const totalDr = ledgerData.reduce((sum, entry) => sum + entry.drAmount, 0);
        const totalCr = ledgerData.reduce((sum, entry) => sum + entry.crAmount, 0);
        const closingBalance = totalDr - totalCr;

        return { totalDr, totalCr, closingBalance };
    };

    const { totalDr, totalCr, closingBalance } = calculateTotals();

    const [ledgerHtml, setLedgerHtml] = useState('');

    useEffect(() => {
        const wrapper = document.querySelector('.ledger-table-wrapper');
        if (wrapper) {
            setLedgerHtml(wrapper.innerHTML);
        }
    }, [filteredLedgerData, totalDr, totalCr, closingBalance]);

    return (<>
        <style>
                {`
                .container {
                    padding: 1.5rem;
                    max-width: 900px;
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
                    font-size: 1rem;
                }
                th {
                    background-color: #61abff;
                    color: #fff;
                    padding: 12px;
                    font-weight: bold;
                    font-family: 'Roboto Slab', Arial, sans-serif;
                }
                td {
                    background-color: #f9f9f9;
                    transition: background 0.3s ease;
                }
                tr:hover td {
                    background: #f1f1f1;
                }
                @keyframes fadeOut {
                    to { background-color: rgba(144, 238, 144, 0); }
                }
                .buttons {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 1rem;
                }
                .btn {
                    padding: 10px 15px;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                    border-radius: 5px;
                    margin: 5px;
                    position: relative;
                    overflow: hidden;
                }
                .add-btn { 
                    background-color: #28a745; 
                    color: white; 
                }
                .save-btn { 
                    background-color: #007bff; 
                    color: white;
                    min-width: 100px;
                }
                .save-btn:disabled {
                    background-color: #6c757d;
                    cursor: not-allowed;
                }
                .save-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background-color: rgba(255, 255, 255, 0.7);
                    transition: width 0.3s ease;
                }
                .del-btn {
                    cursor: pointer;
                    background: none;
                    border: none;
                    color: #dc3545;
                    font-size: 1.2rem;
                }

                /* Placeholder text color */
thead th input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

thead tr th{
    height:30px;
    text-align: center;
}

                thead th {
    position: relative;
    text-align: left;
    padding: 8px;
    
    white-space: nowrap;
}

                `}
            </style>

        <div className="container">
            <h2>Party Ledger</h2>

            <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1.5 }}>
                        <label>Party:</label>
                        <select
                            value={selectedParty}
                            onChange={(e) => {
                                const party = parties.find(p => p._id === e.target.value);
                                setSelectedParty(e.target.value);
                                setSelectedPartyName(party?.PartyName || "All Parties");
                            }}
                            style={{ flex: 0.8, padding: "8px", border:"1px solid lightgray" }}
                        >
                            <option hidden selected value="">Select a party</option>
                            <option value="All Parties">All Parties</option>
                            {parties.map(party => (
                                <option key={party._id} value={party._id}>
                                    {party.PartyName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 0.5 }}>
                        <label>From:</label>
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                            style={{ flex: 1, padding: "8px" }}
                        />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 0.5 }}>
                        <label>To:</label>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                            style={{ flex: 1, padding: "8px" }}
                        />
                    </div>
                </div>
            </div>

            <div className="ledger-table-wrapper">
                {filteredLedgerData.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>SR No.</th>
                                <th>Voucher Date</th>
                                <th>Particulars</th>
                                <th>Dr Amt</th>
                                <th>Cr Amt</th>
                                <th>Narration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLedgerData.map((entry, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                                    <td>{entry.type}</td>
                                    <td style={{ textAlign: 'right' }}>{entry.drAmount.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right' }}>{entry.crAmount.toFixed(2)}</td>
                                    <td>{entry.narration}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan="3">Total</td>
                                <td style={{ textAlign: 'right' }}>{totalDr.toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>{totalCr.toFixed(2)}</td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan="3">Closing Balance</td>
                                <td colSpan="2" style={{ textAlign: 'right' }}>
                                    {closingBalance >= 0
                                        ? `Dr ${Math.abs(closingBalance).toFixed(2)}`
                                        : `Cr ${Math.abs(closingBalance).toFixed(2)}`}
                                </td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>

            {ledgerData.length > 0 && (
                <div style={{ marginTop: "1rem", textAlign: "right" }}>
                    <PrintBtn
                        htmlContent={ledgerHtml}
                        companyName="ABC Pvt Ltd"
                        partyName={selectedPartyName}
                        dateFrom={dateRange.from}
                        dateTo={dateRange.to}
                        buttonText="Print Ledger"
                        isLedger="true"
                    />
                </div>
            )}
        </div>
    </>
    );
}