import express from "express";
import mongoose from "mongoose";
import Joi from "joi";

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/eventsapp");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

// Define Event model with version field
const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, maxLength: 500 },
    location: { type: String, required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["active", "cancelled", "done"], default: "active" },
    __v: { type: Number, select: false } // Version field for optimistic locking (hidden)
});
const Event = mongoose.model("Event", EventSchema);

// Joi validation schemas (include version for update)
const eventValidationSchema = Joi.object({
    title: Joi.string().required().messages({ "string.empty": "Title is required" }),
    description: Joi.string().max(500).messages({ "string.max": "Description cannot exceed 500 characters" }),
    location: Joi.string().required().messages({ "string.empty": "Location is required" }),
    date: Joi.date().required().messages({ "date.base": "Date is invalid or missing" }),
    status: Joi.string().valid("active", "cancelled", "done").default("active"),
});

const updateEventValidationSchema = eventValidationSchema.concat(Joi.object({
    __v: Joi.number().required().messages({ "number.base": "Version is required" }),
}));

const queryValidationSchema = Joi.object({
    location: Joi.string().optional().min(3).max(50),
    date: Joi.date().optional(),
    status: Joi.string().optional().valid("active", "cancelled", "done"),
}).or("location", "date", "status");

// Middleware for validation
const validateRequest = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).send({
            message: "Validation error",
            details: error.details.map((detail) => detail.message),
        });
    }
    next();
};

const validateQuery = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    if (error) {
        return res.status(400).send({
            message: "Validation error",
            details: error.details.map((detail) => detail.message),
        });
    }
    next();
};

// Routes

// Create an event
app.post("/events", validateRequest(eventValidationSchema), async (req, res) => {
    try {
        const event = new Event(req.body);
        const savedEvent = await event.save();
        res.status(201).send(savedEvent);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Error saving event" });
    }
});

// Get all events with filters
app.get("/events", validateQuery(queryValidationSchema), async (req, res) => {
    try {
        const { location, date, status } = req.query;

        const query = {};
        if (location) query.location = location;
        if (date) query.date = new Date(date);
        if (status) query.status = status;

        const events = await Event.find(query);
        res.send(events);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Error fetching events" });
    }
});

// Update an event (with optimistic locking, WITHOUT transaction)
app.put("/events/:id", validateRequest(updateEventValidationSchema), async (req, res) => {
    try {
        const event = await Event.findOneAndUpdate(
            { _id: req.params.id, __v: req.body.__v }, // Optimistic locking condition
            req.body,
            { new: true }
        );

        if (!event) {
            return res.status(409).send({ message: "Event has been updated by another user. Please refresh." });
        }

        res.send(event);
    } catch (err) {
        console.error("Error updating event:", err);
        res.status(500).send({ message: "Error updating event" });
    }
});

// Delete an event (WITHOUT transaction)
app.delete("/events/:id", async (req, res) => {
    try {
        const deletedEvent = await Event.findByIdAndDelete(req.params.id);

        if (!deletedEvent) {
            return res.status(404).send({ message: "Event not found" });
        }

        res.send({ message: "Event deleted successfully" });
    } catch (err) {
        console.error("Error deleting event:", err);
        res.status(500).send({ message: "Error deleting event" });
    }
});

// Start the server
const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});