import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Home from "./Home";
import Parties from "./Parties";
import PartyLedger from "./PartyLedger";
import CreateReceipt from "./CreateReceipt";
import ChangeCompany from "./OpenCompany";
import Items from "./Items";
import Layout1 from "./layouts/Layout1";
import Layout2 from "./layouts/Layout2";
import Layout3 from "./layouts/Layout3";
import "./styles.css"; // Import CSS file
import InvoiceStore from './Settings/InvoiceStore';


function App() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const location = useLocation();
    const navigate = useNavigate();
    const [showOverlay, setShowOverlay] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [margins, setMargins] = useState(InvoiceStore.getInvoiceMargins());
    const [invoiceLayout, setInvoiceLayout] = useState(InvoiceStore.getInvoiceLayout());
    const [valueInWord, setValueInWord] = useState(InvoiceStore.getInvoiceValueInWordType());
    const [connectionStatus, setConnectionStatus] = useState(InvoiceStore.getConnectionToDatabase());

    useEffect(() => {
        const unsubscribe = InvoiceStore.subscribe(({ invoiceValueInWordType, invoiceMargins, invoiceLayout, connectionToDatabase }) => {
            if (invoiceValueInWordType !== undefined) setValueInWord(invoiceValueInWordType);
            if (invoiceMargins !== undefined) setMargins(invoiceMargins);
            if (invoiceLayout !== undefined) setInvoiceLayout(invoiceLayout);
            if (connectionToDatabase !== undefined) setConnectionStatus(connectionToDatabase);
        });

        return unsubscribe;
    }, []);


    const handleMarginChange = (side, value) => {
        const updated = { ...margins, [side]: `${value}px` };
        setMargins(updated);
        InvoiceStore.setInvoiceMargins({ [side]: `${value}px` });
    };


    const [layout, setLayout] = useState([
        { name: "srNo", label: "SrNo", type: "number", align: "left", width: "50px", isReadOnly: true, isMandatory: true },
        { name: "productName", label: "Product Name", type: "text", align: "left", width: "400px", isReadOnly: false, isMandatory: true },
        { name: "hsn", label: "HSN", type: "text", align: "center", width: "80px", isReadOnly: false, isMandatory: true },
        { name: "qty", label: "Qty", type: "number", align: "right", width: "90px", isReadOnly: false, isMandatory: true },
        { name: "rate", label: "Rate", type: "number", align: "right", width: "90px", isReadOnly: false, isMandatory: true },
        { name: "unit", label: "Unit", type: "text", align: "center", width: "45px", isReadOnly: false, isMandatory: true },
        { name: "gst", label: "GST%", type: "number", align: "right", width: "55px", isReadOnly: false, isMandatory: true },
        { name: "amount", label: "Amount", type: "number", align: "right", width: "130px", isReadOnly: true, isMandatory: true },
    ]);

    const updateLayoutOnServer = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/updateBodyLayout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ layout }) // layout is from useState
            });

            const data = await response.json();

            if (data.uid) {
                return data.uid;
            } else {
                return null;
            }
        } catch (err) {
            console.error("Error updating layout:", err);
            return null;
        }
    };



    useEffect(() => {
        const runIfConnectedChanged = async () => {
            if (connectionStatus === "Connected(Changed)") {
                try {
                    // First fetch: Body Layout
                    const bodyLayoutRes = await fetch(`${API_BASE_URL}/getLastBodyLayout`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                    });
                    const bodyData = await bodyLayoutRes.json();

                    if (Array.isArray(bodyData.layout)) {
                        setLayout(bodyData.layout);
                    }

                    // Second fetch: Invoice No Layout
                    const invoiceLayoutRes = await fetch(`${API_BASE_URL}/GetInvoiceNoLayout`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dbName: "yourDatabaseName" }) // Replace if needed
                    });
                    const invoiceData = await invoiceLayoutRes.json();

                    setLayoutOptions(invoiceData.InvoiceNoLayout || []);
                    setInvoiceLayout(invoiceData.InvoiceNoLayout[0]);
                    InvoiceStore.setInvoiceLayout(invoiceData.InvoiceNoLayout[0]);
                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    // Update the store after all operations are done
                    InvoiceStore.setConnectionToDatabase("Updated");
                }
            }
        };

        runIfConnectedChanged();
    }, [connectionStatus]);


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(".dropdown")) {
                setShowDropdown(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleDropdown = (menu) => {
        setShowDropdown((prev) => (prev === menu ? null : menu));
    };


    const [showNavbar, setShowNavbar] = useState(false); // Start with navbar hidden

    useEffect(() => {
        const hasVisited = sessionStorage.getItem("hasVisited"); // Use sessionStorage

        if (!hasVisited) {
            sessionStorage.setItem("hasVisited", "true");
            navigate("/change-company");
        } else {
            setShowNavbar(true);
        }
    }, [navigate]);

    const [layoutOptions, setLayoutOptions] = useState([]);

    const handleUpdateLayout = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/UpdateInvoiceNoLayout`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    dbName: "yourDatabaseName", // replace accordingly
                    newLayout: invoiceLayout
                })
            });

            const result = await response.json();
            console.log(result.message);
        } catch (error) {
            console.error("Failed to update layout", error);
        }

        setShowOverlay(false);
    };


    return (
        <div className="app-container">
            {/* Add a <style> tag for print margins */}
            <style>
                {`
                    @media print {
                        .create-bill-container {
                            margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
                        }
                    }
                    .margin-controls input{
                        border: 1px solid black;
                        margin-bottom: 3px;
                    }
                `}
            </style>

            {/* Only show navbar if:
                - It's not the first load (handled by the useEffect)
                - OR we're not on the change-company page
            */}
            {(showNavbar || location.pathname !== "/change-company") && (
                <nav className="navbar">
                    <div className="nav-left">
                        <Link to="/">Dashboard</Link>

                        <div className="dropdown" style={{marginLeft:'-25px'} }>
                            <button className="nav-btn" onClick={() => toggleDropdown("company")}>Company</button>
                            {showDropdown === "company" && (
                                <div className="dropdown-menu">
                                    <Link to="/change-company">Create/Change</Link>
                                    <Link to="/items">Items</Link>
                                </div>
                            )}
                        </div>

                        <div className="dropdown">
                            <button className="nav-btn" onClick={() => toggleDropdown("party")}>Party</button>
                            {showDropdown === "party" && (
                                <div className="dropdown-menu">
                                    <Link to="/parties">Create/Change</Link>
                                    <Link to="/party-ledger">Party Ledger</Link>
                                </div>
                            )}
                        </div>

                        <div className="dropdown">
                            <button className="nav-btn" onClick={() => toggleDropdown("create")}>Create</button>
                            {showDropdown === "create" && (
                                <div className="dropdown-menu">
                                    <Link to="/create-bill">Bill</Link>
                                    <Link to="/create-receipt">Receipt</Link>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="nav-right">
                        {location.pathname.startsWith("/create-bill") && (
                            <div className="dropdown">
                                <button className="nav-btn" onClick={() => toggleDropdown("layouts")}>Layouts</button>
                                {showDropdown === "layouts" && (
                                    <div className="dropdown-menu">
                                        <button onClick={() => navigate("/create-bill/layout1")}>Layout 1</button>
                                        <button onClick={() => navigate("/create-bill/layout2")}>Layout 2</button>
                                        <button onClick={() => navigate("/create-bill/layout3")}>Layout 3</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {location.pathname.startsWith("/create-bill") && (
                            <button className="nav-btn" onClick={() => setShowOverlay(true)}>Settings</button>
                        )}
                    </div>
                </nav>
            )}

            {showOverlay && (
                <div className="overlay">
                    <div className="overlay-content">
                        <h2>Settings</h2>

                        <hr />

                        <datalist id="invoice-layouts">
                            {layoutOptions.map((layout, index) => (
                                <option key={index} value={layout} />
                            ))}
                        </datalist>

                        <label>
                            Invoice Layout:
                            <input
                                type="text"
                                list="invoice-layouts"
                                value={invoiceLayout}
                                onChange={(e) => InvoiceStore.setInvoiceLayout(e.target.value)}
                            />
                        </label>

                        <hr />

                        <label>
                            Invoice Value In Words Mode:
                            <select
                                value={valueInWord}
                                onChange={(e) => InvoiceStore.setInvoiceValueInWordType(e.target.value)}
                            >
                                <option value="Indian">Indian (Lakh and Crore)</option>
                                <option value="Western">Western (Million and Billion)</option>
                            </select>
                        </label>

                        <hr />

                        <h4>Print Margins</h4>

                        {/* Add margin input fields */}
                        <div className="margin-controls">
                            <label>Top Margin:
                                <input
                                    type="number"
                                    value={parseInt(margins.top)}
                                    onChange={(e) => handleMarginChange("top", e.target.value)}
                                /> px
                            </label><br/>
                            <label>Right Margin:
                                <input
                                    type="number"
                                    value={parseInt(margins.right)}
                                    onChange={(e) => handleMarginChange("right", e.target.value)}
                                /> px
                            </label><br />
                            <label>Bottom Margin:
                                <input
                                    type="number"
                                    value={parseInt(margins.bottom)}
                                    onChange={(e) => handleMarginChange("bottom", e.target.value)}
                                /> px
                            </label><br />
                            <label>Left Margin:
                                <input
                                    type="number"
                                    value={parseInt(margins.left)}
                                    onChange={(e) => handleMarginChange("left", e.target.value)}
                                /> px
                            </label>
                        </div>

                        <button onClick={handleUpdateLayout}>Update</button>
                    </div>
                </div>
            )}

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/change-company" element={<ChangeCompany />} />
                <Route path="/parties" element={<Parties />} />
                <Route path="/items" element={<Items />} />
                <Route path="/create-bill" element={<Layout1 layout={layout} setLayout={setLayout} updateLayoutOnServer={updateLayoutOnServer} />} />
                <Route path="/create-bill/layout1" element={<Layout1 layout={layout} setLayout={setLayout} updateLayoutOnServer={updateLayoutOnServer} />} />
                <Route path="/create-bill/layout2" element={<Layout2 />} />
                <Route path="/create-bill/layout3" element={<Layout3 />} />
                <Route path="/party-ledger" element={<PartyLedger />} />
                <Route path="/create-receipt" element={<CreateReceipt />} />
            </Routes>
        </div>
    );
}

export default App;