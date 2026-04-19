import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import InvoiceStore from './Settings/InvoiceStore';

const OpenCompany = () => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    function generateUID() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let uid = '';
        for (let i = 0; i < 7; i++) {
            uid += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return uid;
    }

    const [connectionStatus, setConnectionStatus] = useState(InvoiceStore.getConnectionToDatabase());
    useEffect(() => {
        const unsubscribe = InvoiceStore.subscribe(({ connectionToDatabase }) => {
            if (connectionToDatabase !== undefined) setConnectionStatus(connectionToDatabase);
        });

        return unsubscribe;
    }, []);

    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("create");
    const [companyName, setCompanyName] = useState("");
    const [addresses, setAddresses] = useState([{ SrNo: 1, Address: "", GSTIN: "", RandomUID: generateUID() }]);
    const [oldDetailNo, setOldDetailNo] = useState([]);
    const [otherDetails, setOtherDetails] = useState({});
    const [bankDetails, setBankDetails] = useState({
        BankName: "",
        BankAccountNo: "",
        BankBranch: "",
        BankIFSCNo: ""
    });

    const [selectedCompany, setSelectedCompany] = useState("");
    const [openCompanyName, setOpenCompanyName] = useState("");
    const [openCompanyAddresses, setOpenCompanyAddresses] = useState([{ SrNo: 1, Address: "", GSTIN: "", RandomUID: generateUID() }]);
    const [openBankDetails, setOpenBankDetails] = useState({
        BankName: "",
        BankAccountNo: "",
        BankBranch: "",
        BankIFSCNo: ""
    });

    const [allCompanies, setAllCompanies] = useState([]);
    const [companyToDelete, setCompanyToDelete] = useState("");

    useEffect(() => {
        // Fetch all companies when component mounts or when tab changes
        const fetchCompanies = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/get-all-companies`);
                setAllCompanies(response.data.companies || []);
            } catch (error) {
                console.error("Error fetching companies:", error);
            }
        };

        fetchCompanies();
    }, [activeTab]);

    useEffect(() => {
        setAddresses(prevAddresses => {
            const updatedAddresses = prevAddresses.map((item, index) => ({
                ...item,
                SrNo: index + 1
            }));

            if (JSON.stringify(updatedAddresses) === JSON.stringify(prevAddresses)) {
                return prevAddresses;
            }

            return updatedAddresses;
        });
    }, [addresses]);

    useEffect(() => {
        setOpenCompanyAddresses(prevAddresses => {
            const updatedAddresses = prevAddresses.map((item, index) => ({
                ...item,
                SrNo: index + 1
            }));

            if (JSON.stringify(updatedAddresses) === JSON.stringify(prevAddresses)) {
                return prevAddresses;
            }

            return updatedAddresses;
        });
    }, [openCompanyAddresses]);

    const switchTab = (tab) => {
        setActiveTab(tab);
    };

    const addAddressField = () => {
        setAddresses([...addresses, { SrNo: addresses.length + 1, Address: "", GSTIN: "", RandomUID: generateUID() }]);
    };

    const deleteAddressField = (index) => {
        setAddresses(addresses.filter((_, i) => i !== index));
    };

    const updateAddressField = (index, field, value) => {
        const updatedAddresses = [...addresses];
        updatedAddresses[index][field] = value;
        setAddresses(updatedAddresses);
    };

    const updateOpenCompanyAddressField = (index, field, value) => {
        const updatedAddresses = [...openCompanyAddresses];
        updatedAddresses[index][field] = value;
        setOpenCompanyAddresses(updatedAddresses);
    };

    const addOpenAddressField = () => {
        setOpenCompanyAddresses([...openCompanyAddresses, { SrNo: openCompanyAddresses.length + 1, Address: "", GSTIN: "", RandomUID: generateUID() }]);
    };

    const deleteOpenCompanyAddress = (index) => {
        setOpenCompanyAddresses(openCompanyAddresses.filter((_, i) => i !== index));
    };

    const validateAndSubmit = async () => {
        const warningDiv = document.getElementById("company-warning");
        warningDiv.classList.add("hidden");

        let formattedName = companyName.trim().toLowerCase().replace(/\s+/g, "-");

        const isValid = /^[a-z0-9-]+$/.test(formattedName); // Only lowercase letters, numbers, and dashes
        if (!formattedName || !isValid) {
            warningDiv.style.display = "block";
            return;
        } else {
            warningDiv.style.display = "none";
            setCompanyName(formattedName);
        }

        if (addresses.length < 1) {
            alert("At least one Address-GSTIN pair is required.");
            return;
        }

        for (const addr of addresses) {
            if (!addr.Address.trim() || !addr.GSTIN.trim()) {
                alert("Each address must have a corresponding GSTIN.");
                return;
            }
        }

        for (const key in bankDetails) {
            if (!bankDetails[key].trim()) {
                alert("All bank details are required.");
                return;
            }
        }

         // update formatted name
        const message = await handleCreateCompany(formattedName);
        alert(message);
    };


    const handleCreateCompany = async (customCompanyName) => {
        try {
            const currentCompanyName = customCompanyName.toLowerCase();
            const currentAddresses = addresses;
            const currentBankDetails = bankDetails;

            const response = await axios.post(`${API_BASE_URL}/create-database`, {
                companyName: currentCompanyName,
                tabCompanyData: { addresses: currentAddresses, bankDetails: currentBankDetails }
            });

            // Reset form
            setCompanyName("");
            setAddresses([{ SrNo: 1, Address: "", GSTIN: "", RandomUID: generateUID() }]);
            setBankDetails({
                BankName: "",
                BankAccountNo: "",
                BankBranch: "",
                BankIFSCNo: ""
            });

            InvoiceStore.setConnectionToDatabase("Connected(Changed)");

            return response.data.message;
        } catch (error) {
            return "Error creating database: " + (error.response?.data?.error || error.message);
        }
    };


    const handleCheckCompany = async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/check-database-exists`, {
                dbName: selectedCompany.toLowerCase()
            });

            return response.data.exists;
        } catch (error) {
            return "Error finding database. " + error.response?.data?.error || error.message;
        }
    };

    const getDBData = async (selectedCompany) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/get-db-data`, { companyName: selectedCompany });
            InvoiceStore.setConnectionToDatabase("Connected(Changed)");


            return response.data;
        } catch (error) {
            return { error: "Error getting database data. " + (error.response?.data?.error || error.message) };
        }
    };

    const handleOpenCompany = async () => {
        if (!selectedCompany.trim()) {
            alert("Please select a company.");
            return;
        }

        const dbExists = await handleCheckCompany();

        if (dbExists) {
            setOpenCompanyName(selectedCompany);

            const dbData = await getDBData(selectedCompany);

            const formattedAddresses = dbData.addresses.map((item, index) => ({
                SrNo: index + 1,
                Address: item.Addr,
                GSTIN: item.GSTIN,
                RandomUID: item.DetailNo
            }));

            const formattedBankDetails = dbData.bankData.length > 0 ? {
                BankName: dbData.bankData[0].BankName,
                BankAccountNo: dbData.bankData[0].BankACNo,
                BankBranch: dbData.bankData[0].BankBranch,
                BankIFSCNo: dbData.bankData[0].BankIFSCNo
            } : {};

            const formattedOtherDetails = dbData.other.length > 0 ? {
                TandC: dbData.other[0].TandC,
                Declaration: dbData.other[0].Declaration
            } : {};

            setOldDetailNo(formattedAddresses.map(item => item.RandomUID));
            setOpenCompanyAddresses(formattedAddresses);
            setOpenBankDetails(formattedBankDetails);
            setOtherDetails(formattedOtherDetails);

            document.querySelector('.selectOpenCompany').style.display = 'none';
            document.querySelector('.OpenCompanyDetails').style.display = 'block';
        } else {
            alert("Database not found for this company.");
        }
    };

    const saveExistingCompany = async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/update-company`, {
                companyName: openCompanyName.toLowerCase(),
                tabCompanyData: { oldDetailNo, openCompanyAddresses, openBankDetails, otherDetails }
            });

            navigate("/");
        } catch (error) {
            alert("Error updating company: " + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteCompany = async () => {
        if (!companyToDelete.trim()) {
            alert("Please select a company to delete.");
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${companyToDelete}?\nIt will delete all the bills and data of that company.\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/delete-company`, {
                companyName: companyToDelete.toLowerCase()
            });

            alert(response.data.message);
            setCompanyToDelete("");
            // Refresh the company list
            const updatedResponse = await axios.get(`${API_BASE_URL}/get-all-companies`);
            setAllCompanies(updatedResponse.data.companies || []);
        } catch (error) {
            alert("Error deleting company: " + (error.response?.data?.error || error.message));
        }
    };

    return (<>
        <style>{`
      body {
        font-family: 'Arial', sans-serif;
        background-color: #f0f8ff;
        margin: 0;
      }

      .container {
        width: 100%;
        max-width: 220mm;
        margin: 0 auto;
        padding: 20px;
      }

      .flex.items-center {
        display: flex;
        align-items: center;
      }

      button.text-red-500 {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        margin-left: 8px;
      }

      .flex {
        display: flex;
        justify-content: center;
      }

      button {
        padding: 10px 20px;
        border: none;
        cursor: pointer;
        font-size: 16px;
        border-radius: 5px;
        transition: 0.3s ease-in-out;
      }

      button.bg-blue-500 {
        background-color: #4a90e2;
        color: white;
      }

      button.bg-gray-300 {
        background-color: #dceeff;
        color: #4a90e2;
      }

      button:hover {
        opacity: 0.8;
      }

      .bg-white {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
        margin-top: 20px;
      }

      h2 {
        font-size: 20px;
        color: #4a90e2;
        margin-bottom: 10px;
      }

      h3 {
        font-size: 18px;
        color: #6b7280;
        margin-top: 15px;
      }

      label {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        display: block;
        margin-bottom: 5px;
      }

      input, textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #cce7ff;
        border-radius: 5px;
        font-size: 14px;
        background-color: #f8fbff;
        height:18px;
      }

      textarea {
        white-space: nowrap;
        overflow-x: auto;
      }

      input:focus, textarea:focus {
        outline: none;
        border-color: #4a90e2;
        background-color: white;
      }
      
      .flex.space-x-2 {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      span.w-12 {
        width: 30px;
        text-align: center;
        font-weight: bold;
        color: #4a90e2;
      }

      button.bg-green-500 {
        background-color: #32a852;
        color: white;
        padding: 8px 12px;
        font-size: 14px;
        margin-top: 10px;
      }

      button.bg-green-500:hover {
        background-color: #289944;
      }

      button.bg-blue-500 {
        width: 100%;
        margin-top: 20px;
      }

      .company-list {
        margin-top: 15px;
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 5px;
      }

      .company-item {
        padding: 8px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .company-item:last-child {
        border-bottom: none;
      }

      .delete-btn {
        color: #ff4444;
        cursor: pointer;
      }

      #company-warning {
          color: red;
          display: none;
          margin-top: 8px;
          font-size: 14px;
        }

    `}</style>

        <div className="container ">
            {/* Navigation Buttons */}
            <div className="flex">
                <button
                    onClick={() => switchTab("create")}
                    className={`px-4 py-2 ${activeTab === "create" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
                >
                    Create Company
                </button>
                <button
                    onClick={() => switchTab("open")}
                    className={`px-4 py-2 ${activeTab === "open" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
                >
                    Select Company
                </button>
                <button
                    onClick={() => switchTab("delete")}
                    className={`px-4 py-2 ${activeTab === "delete" ? "bg-blue-500 text-white" : "bg-gray-300"}`}
                >
                    Delete Company
                </button>
            </div>

            {/* Create Company Section */}
            {activeTab === "create" && (
                <div className="bg-white p-4 shadow-lg rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Create a New Company</h2>

                    {/* Company Name */}
                    <div style={{ paddingRight: '20px' }} className="mb-4">
                        <label className="block text-gray-700">Company Name</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>

                    {/* Address & GSTIN Section */}
                    <h3 className="text-lg font-semibold mb-2">Company Addresses & GSTIN</h3>
                    {addresses.map((entry, index) => (
                        <div key={index} className="flex space-x-2 mb-2">
                            <span className="w-12 text-center">{entry.SrNo}.</span>
                            <textarea
                                type="text"
                                placeholder="Address"
                                value={entry.Address}
                                onChange={(e) => updateAddressField(index, "Address", e.target.value)}
                                className="border p-2 flex-grow"
                            ></textarea>
                            <input
                                type="text"
                                placeholder="GSTIN"
                                value={entry.GSTIN}
                                onChange={(e) => updateAddressField(index, "GSTIN", e.target.value)}
                                className="border p-2 flex-grow"
                            />
                            <button onClick={() => deleteAddressField(index)} className='text-red-500'>🗑️</button>
                        </div>
                    ))}
                    <button onClick={addAddressField} className="bg-green-500 text-white px-3 py-1 rounded">
                        + Add Address
                    </button>

                    {/* Bank Details */}
                    <h3 className="text-lg font-semibold mt-4">Bank Details</h3>
                    {Object.keys(bankDetails).map((key) => (<div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
                        <span>{key}:</span>
                        <input
                            key={key}
                            type={key === "BankAccountNo" ? "number" : "text"}
                            placeholder={key}
                            value={bankDetails[key]}
                            onChange={(e) => setBankDetails({ ...bankDetails, [key]: e.target.value })}
                            className=""
                        /></div>
                    ))}

                    {/* Submit Button */}
                    <button onClick={() => validateAndSubmit()} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
                        Create Company
                    </button>
                    <div id="company-warning">
                        Invalid Company Name. No Special Characters are allowed. Only letters, numbers and dashes allowed.
                    </div>
                </div>
            )}

            {/* Open Company Section */}
            {activeTab === "open" && (
                <div className="bg-white p-4 shadow-lg rounded-lg">
                    <div style={{ paddingRight: '20px' }} className='selectOpenCompany'>
                        <h2 className="text-xl font-semibold mb-4">Open an Existing Company</h2>

                        {/* Company Selection */}
                        <div className="mb-4">
                            <label className="block text-gray-700">Select Company</label>
                            <input
                                list="companies"
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className=""
                            />
                            <datalist id="companies">
                                {allCompanies.map((comp, index) => (
                                    <option key={index} value={comp} />
                                ))}
                            </datalist>
                        </div>

                        {/* Open Company Button */}
                        <button onClick={handleOpenCompany} className="bg-green-500 text-white px-4 py-2 rounded">
                            Connect Company
                        </button>
                    </div>
                    <div className='OpenCompanyDetails' hidden>
                        <h3 className="text-lg font-semibold mb-2" style={{ textAlign: 'center' }}>
                            <span style={{ color: '#349eeb' }}>{openCompanyName}</span>
                            {openCompanyName && (
                                <> (<span style={{ color: 'green' }}>Connected</span>)</>
                            )}
                        </h3>
                        {/* Address & GSTIN Section */}
                        <h3 className="text-lg font-semibold mb-2">Company Addresses & GSTIN</h3>
                        {openCompanyAddresses.map((entry, index) => (
                            <div key={index} className="flex space-x-2 mb-2">
                                <span className="w-12 text-center">{entry.SrNo}.</span>
                                <textarea
                                    placeholder="Address"
                                    value={entry.Address}
                                    onChange={(e) => updateOpenCompanyAddressField(index, "Address", e.target.value)}
                                    className="border p-2 flex-grow"
                                ></textarea>

                                <input
                                    type="text"
                                    placeholder="GSTIN"
                                    value={entry.GSTIN}
                                    onChange={(e) => updateOpenCompanyAddressField(index, "GSTIN", e.target.value)}
                                    className="border p-2 flex-grow"
                                />
                                <button onClick={() => deleteOpenCompanyAddress(index)} className="text-red-500">🗑️</button>
                            </div>
                        ))}
                        <button onClick={addOpenAddressField} className="bg-green-500 text-white px-3 py-1 rounded">
                            + Add Address
                        </button>

                        {/* Bank Details */}
                        <br />
                        <br />
                        <h3 className="text-lg font-semibold mt-4">Bank Details</h3>
                        {Object.keys(openBankDetails).map((key) => (<div style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
                            <span>{key}:</span>
                            <input
                                key={key}
                                type={key === "BankAccountNo" ? "number" : "text"}
                                placeholder={key}
                                value={openBankDetails[key]}
                                onChange={(e) => setOpenBankDetails({ ...openBankDetails, [key]: e.target.value })}
                                className=""
                            /></div>
                        ))}

                        {/* Submit Button */}
                        <button onClick={saveExistingCompany} className="bg-blue-500 text-white px-4 py-2 rounded mt-4">
                            Update Company
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Company Section */}
            {activeTab === "delete" && (
                <div className="bg-white p-4 shadow-lg rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Delete a Company</h2>

                    <div style={{ paddingRight: '20px' }} className="mb-4">
                        <label className="block text-gray-700">Select Company to Delete</label>
                        <input
                            list="companies-delete"
                            value={companyToDelete}
                            onChange={(e) => setCompanyToDelete(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                        <datalist id="companies-delete">
                            {allCompanies.map((comp, index) => (
                                <option key={index} value={comp} />
                            ))}
                        </datalist>
                    </div>

                    <div className="company-list">
                        {allCompanies.length > 0 ? (
                            allCompanies.map((company, index) => (
                                <div key={index} className="company-item">
                                    <span>{company}</span>
                                    <span
                                        className="delete-btn"
                                        onClick={() => {
                                            setCompanyToDelete(company);
                                        }}
                                    >
                                        🗑️
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p>No companies found</p>
                        )}
                    </div>
                    <br />
                    <button
                        onClick={handleDeleteCompany}
                        className="bg-red-500 text-white px-4 py-2 rounded mt-4 w-full"
                        disabled={!companyToDelete}
                    >
                        Delete Company
                    </button>
                </div>
            )}
        </div>
    </>
    );
};

export default OpenCompany;