import React, { useEffect, useState } from "react";
import GSTStateInput from "./layouts/GSTStateInput";

export default function Parties() {
    const [parties, setParties] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchPartyData();
    }, []);

    const fetchPartyData = async () => {
        try {
            const response = await fetch("http://localhost:5000/getpartydata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await response.json();
            setParties(data.map(party => ({
                ...party,
                isNew: false,
                isEdited: false,
                Details: party.Details.map(detail => ({
                    ...detail,
                    isNew: false,
                    isEdited: false
                }))
            })));
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
            if (party._id.$oid === partyId) {
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
            if (party._id.$oid === partyId) {
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
            if (party._id.$oid === partyId) {
                return {
                    ...party,
                    Details: party.Details.map(address => {
                        if (address._id.$oid === addressId) {
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

    const deleteParty = async (partyId) => {
        if (partyId.startsWith("new-")) {
            setParties(parties.filter(party => party._id.$oid !== partyId));
        } else {
            await fetch("http://localhost:5000/deleteparty", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: { _id: { $oid: partyId } } })
            });
            setParties(parties.filter(party => party._id.$oid !== partyId));
        }
    };

    const deleteAddress = async (partyId, addressId) => {
        setParties(parties.map(party => {
            if (party._id.$oid === partyId) {
                return {
                    ...party,
                    Details: party.Details.filter(addr => addr._id.$oid !== addressId),
                    isEdited: true
                };
            }
            return party;
        }));
    };

    const saveChanges = async () => {
        setIsSaving(true);
        // Save logic here
        setIsSaving(false);
        fetchPartyData();
    };

    return (
        <div className="container">
            <style>
                {`
    .container {
        padding: 1.5rem;
        max-width: 1200px;
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
        padding: 12px;
        text-align: left;
        font-size: 1rem;
    }

    th {
        background-color: #61abff;
        color: #fff;
        font-weight: bold;
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

    .add-btn {
        background-color: #28a745;
        color: white;
    }

    .save-btn {
        background-color: #007bff;
        color: white;
    }
    .buttons-container{
        display:flex;
    }
    `}
            </style>
            <h2>Parties</h2>
            <table>
                <thead>
                    <tr>
                        <th>Party Name</th>
                        <th>Address Details</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {parties.map((party) => (
                        <tr key={party._id.$oid} className={party.isEdited ? 'unsaved' : ''}>
                            <td>
                                <input
                                    type="text"
                                    value={party.PartyName}
                                    onChange={(e) => handlePartyChange(party._id.$oid, "PartyName", e.target.value)}
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
                                                <tr key={detail._id.$oid}>
                                                    <td>
                                                        <textarea
                                                            value={detail.Addr}
                                                            onChange={(e) => handleAddressChange(party._id.$oid, detail._id.$oid, "Addr", e.target.value)}
                                                            className="address-textarea"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={detail.GSTIN}
                                                            onChange={(e) => handleAddressChange(party._id.$oid, detail._id.$oid, "GSTIN", e.target.value)}
                                                            className="address-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <GSTStateInput
                                                            value={detail.PartyStateAndCode}
                                                            onChange={(value) => handleAddressChange(party._id.$oid, detail._id.$oid, "PartyStateAndCode", value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="action-btn delete-btn"
                                                            onClick={() => deleteAddress(party._id.$oid, detail._id.$oid)}
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
                                    onClick={() => deleteParty(party._id.$oid)}
                                >
                                    Delete Party
                                </button>
                                <button
                                    className="action-btn add-btn"
                                    onClick={() => addNewAddress(party._id.$oid)}
                                    style={{ marginTop: "8px" }}
                                >
                                    + Add Address
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="buttons-container">
                <button className="action-btn add-btn" onClick={addNewParty}>
                    + Add Party
                </button>
                <button
                    className="action-btn save-btn"
                    onClick={saveChanges}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
