import React, { useEffect, useState } from "react";
import GSTStateInput from "./layouts/GSTStateInput";

export default function Parties() {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const [parties, setParties] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editedRows, setEditedRows] = useState({});
    const [saveProgress, setSaveProgress] = useState(0);

    useEffect(() => {
        fetchPartyData();
    }, []);

    const fetchPartyData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/getpartydata`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            const data = await response.json();

            // Normalize _id so it's always a string
            const formattedData = data.map(party => ({
                ...party,
                _id: party._id.$oid || party._id,
                isNew: false,
                isEdited: false,
                Details: party.Details.map(detail => ({
                    ...detail,
                    _id: detail._id.$oid || detail._id,
                    isNew: false,
                    isEdited: false
                }))
            }));
            
            setParties(formattedData);
        } catch (error) {
            console.error("Error fetching party data:", error);
        }
    };

    const addNewParty = () => {
        const newParty = {
            _id: { $oid: `new-${Date.now()}` },
            PartyName: "",
            Details: [],
            isNew: true
        };
        setParties([...parties, newParty]);
    };

    const addNewAddress = (partyId) => {
        setParties(parties.map(party => {
            if ((party._id.$oid || party._id) === partyId) {
                return {
                    ...party,
                    Details: [
                        ...party.Details,
                        {
                            _id: { $oid: `new-addr-${Date.now()}` },
                            Addr: "",
                            GSTIN: "",
                            PartyStateAndCode: "",
                            isNew: true
                        }
                    ],
                    isEdited: true
                };
            }
            return party;
        }));
    };

    const handlePartyChange = (partyId, field, value) => {
        setParties(parties.map(party => {
            if ((party._id.$oid || party._id) === partyId) {
                return {
                    ...party,
                    [field]: value,
                    isEdited: true
                };
            }
            return party;
        }));
    };

    const handleAddressChange = (partyId, addressId, field, value) => {
        setParties(parties.map(party => {
            if ((party._id.$oid || party._id) === partyId) {
                return {
                    ...party,
                    Details: party.Details.map(address => {
                        if ((address._id.$oid || address._id) === addressId) {
                            return {
                                ...address,
                                [field]: value,
                                isEdited: true
                            };
                        }
                        return address;
                    }),
                    isEdited: true
                };
            }
            return party;
        }));
    };

    const saveChanges = async () => {
        setIsSaving(true);
        setSaveProgress(0);

        const newParties = parties.filter(party => party.isNew);
        const updatedParties = parties.filter(party => party.isEdited && !party.isNew);
        const newAddresses = [];
        const updatedAddresses = [];

        parties.forEach(party => {
            party.Details.forEach(address => {
                if (address.isNew) {
                    newAddresses.push({ ...address, PartyId: party._id?.$oid || party._id });
                } else if (address.isEdited) {
                    updatedAddresses.push(address);
                }
            });
        });

        const totalOperations = newParties.length + updatedParties.length + newAddresses.length + updatedAddresses.length;
        let completedOperations = 0;

        for (let party of newParties) {
            let detailIDs = [];

            //if (parties.includes(party)) {
            //    alert(`The party '${party.PartyName}' already exists.`);
            //    setIsSaving(false);
            //    setSaveProgress(0);
            //    return;
            //}

            // Insert the party and get the ID
            const partyResponse = await fetch(`${API_BASE_URL}/insertparty`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    PartyName: party.PartyName,
                    DetailIDs: detailIDs,
                    PhoneNumber: party.PhoneNumber
                })
            });

            const partyData = await partyResponse.json();
			
            const partyId = partyData.insertedId; // Extract PartyId correctly

            // Insert addresses
            for (let address of party.Details) {
                const addressResponse = await fetch(`${API_BASE_URL}/insertaddress`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        Addr: address.Addr,
                        GSTIN: address.GSTIN,
                        PartyStateAndCode: address.PartyStateAndCode,
                        parentParty: partyId // Pass the correct parent party ID
                    })
                });

                const addressData = await addressResponse.json();
                if (addressData.success && addressData.insertedId) {
                    detailIDs.push(addressData.insertedId);
                }

                completedOperations++;
                setSaveProgress((completedOperations / totalOperations) * 100);
            }

            // Update the Party with collected detailIDs
            if (detailIDs.length > 0) {
                await fetch(`${API_BASE_URL}/updateparty`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        PartyId: partyId,
                        updateFields: { DetailIDs: detailIDs }
                    })
                });
            }

            completedOperations++;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }

        // Insert new addresses for existing parties
        for (let address of newAddresses.filter(addr => !String(addr.PartyId).startsWith("new-"))) {
            await fetch(`${API_BASE_URL}/insertaddress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Addr: address.Addr,
                    GSTIN: address.GSTIN,
                    PartyStateAndCode: address.PartyStateAndCode,
                    parentParty: address.PartyId // Corrected case `partyId -> PartyId`
                })
            });

            completedOperations++;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }


        for (let party of updatedParties) {
            await fetch(`${API_BASE_URL}/updateparty`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    PartyId: party._id?.$oid || party._id,
                    updateFields: {
                        PartyName: party.PartyName,
                        DetailIDs: party.Details.map(d => d.DetailNo),
                        PhoneNumber: party.PhoneNumber
                    }
                })
            });
            completedOperations++;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }

        for (let address of updatedAddresses) {
            await fetch(`${API_BASE_URL}/updateaddress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    DetailNo: address.DetailNo,
                    updateFields: {
                        Addr: address.Addr,
                        GSTIN: address.GSTIN,
                        PartyStateAndCode: address.PartyStateAndCode
                    }
                })
            });
            completedOperations++;
            setSaveProgress((completedOperations / totalOperations) * 100);
        }

        setParties(prevParties =>
            prevParties.map(party => ({
                ...party,
                isNew: false,
                isEdited: false,
                Details: party.Details.map(address => ({
                    ...address,
                    isNew: false,
                    isEdited: false
                }))
            }))
        );

        setEditedRows({});
        setTimeout(() => {
            setIsSaving(false);
            setSaveProgress(0);
        }, 500);

        fetchPartyData();
    };

    const deleteParty = async (partyId) => {
        const partyIdToSend = partyId?.$oid || partyId;

        if (String(partyIdToSend).startsWith("new-")) {
            setParties(parties.filter(party => (party._id.$oid || party._id) !== partyIdToSend));
        } else {
            // Send initial request with approved=false
            const initialResponse = await fetch(`${API_BASE_URL}/deleteparty`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ PartyId: partyIdToSend, approved: 'false' })
            });

            const data = await initialResponse.json();

            // If approval is requested, show the message and ask for confirmation
            if (data.requestingApproval) {
                const userConfirmed = window.confirm(data.message + " Do you want to proceed with deletion?");
                if (userConfirmed) {
                    // If user confirms, send the approved=true to proceed with deletion
                    const finalResponse = await fetch(`${API_BASE_URL}/deleteparty`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ PartyId: partyIdToSend, approved: 'true' })
                    });

                    const finalData = await finalResponse.json();

                    if (finalData.success) {
                        // Handle success after deletion
                        alert("Party deleted successfully.");
                        setParties(parties.filter(party => (party._id.$oid || party._id) !== partyIdToSend));
                    } else {
                        // Handle failure
                        alert("Failed to delete party: " + finalData.error);
                    }
                }
            } else {
                // If no bills are using the party, proceed with deletion immediately
                alert(data.message);
                setParties(parties.filter(party => (party._id.$oid || party._id) !== partyIdToSend));
            }
        }
    };


    const deleteAddress = async (partyId, addressId) => {
        const partyIdToSend = partyId?.$oid || partyId;
        const addressIdToSend = addressId?.$oid || addressId;

        console.log('to delete detailno:', addressIdToSend);

        if (String(addressIdToSend).startsWith("new-addr-")) {
            setParties(parties.map(p => {
                if ((p._id.$oid || p._id) === partyIdToSend) {
                    return {
                        ...p,
                        Details: p.Details.filter(a => (a._id?.$oid || a._id) !== addressIdToSend),
                        isEdited: true
                    };
                }
                return p;
            }));
        } else {
            const initialResponse = await fetch(`${API_BASE_URL}/deleteaddress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ DetailNo: addressIdToSend, approved: 'false' })
            });

            const data = await initialResponse.json();

            if (data.success && data.requestingApproval === false) {
                // Deleted directly (address not in use)
                alert(data.message);
                setParties(parties.map(p => {
                    if ((p._id.$oid || p._id) === partyIdToSend) {
                        return {
                            ...p,
                            Details: p.Details.filter(a => (a._id?.$oid || a._id) !== addressIdToSend),
                            isEdited: true
                        };
                    }
                    return p;
                }));
            } else if (data.requestingApproval) {
                const userConfirmed = window.confirm(data.message + " Do you want to proceed with deletion?");
                if (userConfirmed) {
                    const finalResponse = await fetch(`${API_BASE_URL}/deleteaddress`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ DetailNo: addressIdToSend, approved: 'true' })
                    });

                    const finalData = await finalResponse.json();

                    if (finalData.success) {
                        alert("Address deleted successfully.");
                        setParties(parties.map(p => {
                            if ((p._id.$oid || p._id) === partyIdToSend) {
                                return {
                                    ...p,
                                    Details: p.Details.filter(a => (a._id?.$oid || a._id) !== addressIdToSend),
                                    isEdited: true
                                };
                            }
                            return p;
                        }));
                    } else {
                        alert("Failed to delete address: " + finalData.error);
                    }
                }
            } else {
                // If none of the above (fallback)
                alert("Unexpected response: " + data.message || "Please try again.");
            }
        }
    };





    return (
        <div className="container">
            <style>
                {`
    .container {
        padding: 1.5rem;
        max-width: 1250px;
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
        padding: 12px;
        text-align: left;
        font-size: 1rem;
    }

    th {
        background-color: #61abff;
        color: #fff;
        font-family: 'Roboto Slab', Arial, sans-serif;
    }

    .action-btn {
        padding: 6px 10px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .delete-btn {
        background-color: #ff4444;
        color: white;
    }
    .btn {
        padding: 9px 15px;
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
    .buttons-container{
        display: flex;
        justify-content: space-between;
        margin-top: 1rem;
    }
    thead tr th{
        height:20px;
    }

    `}
            </style>
            <h2>Parties</h2>
            <table>
                <thead>
                    <tr>
                        <th>Party Name</th>
                        <th>Phone Number</th>
                        <th>Address Details</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {parties.length > 0 ? (
                        parties.map((party) => (
                            <tr key={party._id?.$oid || party._id} className={party.isEdited ? 'unsaved' : ''}>
                                <td>
                                    <input style={{width:'280px'} }
                                        type="text"
                                        value={party.PartyName}
                                        onChange={(e) => handlePartyChange(party._id?.$oid || party._id, "PartyName", e.target.value)}
                                        className="address-input"
                                    />
                                </td>
                                <td>
                                    <input style={{ width: '110px' }}
                                        type="text"
                                        value={party.PhoneNumber}
                                        onChange={(e) => handlePartyChange(party._id?.$oid || party._id, "PhoneNumber", e.target.value)}
                                        className="address-input"
                                    />
                                </td>
                                <td>
                                    <table style={{ width: "100%" }}>
                                        <thead>
                                            <tr>
                                                <th>Address</th>
                                                <th>GSTIN</th>
                                                <th>State & Code</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {party.Details.length > 0 ? (
                                                party.Details.map((detail) => (
                                                    <tr key={detail._id?.$oid || detail._id}>
                                                        <td>
                                                            <textarea 
                                                                value={detail.Addr}
                                                                onChange={(e) => handleAddressChange(party._id?.$oid || party._id, detail._id?.$oid || detail._id, "Addr", e.target.value)}
                                                                className="address-textarea"
                                                            />
                                                        </td>
                                                        <td>
                                                            <input style={{ width: '140px' }}
                                                                type="text"
                                                                value={detail.GSTIN}
                                                                onChange={(e) => handleAddressChange(party._id?.$oid || party._id, detail._id?.$oid || detail._id, "GSTIN", e.target.value)}
                                                                className="address-input"
                                                            />
                                                        </td>
                                                        <td>
                                                            <GSTStateInput
                                                                value={detail.PartyStateAndCode}
                                                                onChange={(value) => handleAddressChange(party._id?.$oid || party._id, detail._id?.$oid || detail._id, "PartyStateAndCode", value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="action-btn delete-btn"
                                                                onClick={() => deleteAddress(party._id?.$oid || party._id, detail.DetailNo)}
                                                            >
                                                                Delete Address
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan="4">No Addresses Available</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </td>
                                <td>
                                    <button
                                        className="action-btn delete-btn"
                                        onClick={() => deleteParty(party._id?.$oid || party._id)}
                                    >
                                        Delete Party
                                    </button>
                                    <button
                                        className="action-btn add-btn"
                                        onClick={() => addNewAddress(party._id?.$oid || party._id)}
                                        style={{ marginTop: "8px" }}
                                    >
                                        + Add Address
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="3" style={{ textAlign: "center", padding: "10px" }}>
                                No Parties Found
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="buttons-container">
                <button className="btn add-btn" onClick={addNewParty}>
                    ➕ Add Party
                </button>
                <button
                    className="btn save-btn"
                    onClick={saveChanges}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : '💾 Save Changes'}
                    {isSaving && <div className="save-progress" style={{ width: `${saveProgress}%` }}></div>}
                </button>
            </div>
        </div>
    );
}
