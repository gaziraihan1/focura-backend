export const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);
    if (err.code === "P2002") {
        return res.status(400).json({
            success: false,
            message: "A record with this value already exists",
            field: err.meta?.target,
        });
    }
    if (err.code === "P2003") {
        return res.status(400).json({
            success: false,
            message: "Invalid reference to related record",
        });
    }
    if (err.code === "P2025") {
        return res.status(404).json({
            success: false,
            message: "Record not found",
        });
    }
    if (err.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: err.errors,
        });
    }
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};
//# sourceMappingURL=errorHandler.js.map