/**
 * Pagination Utility for Mongoose
 * @param {Model} model - Mongoose Model
 * @param {Object} query - Mongoose query object
 * @param {Object} reqQuery - Request query containing page and limit
 * @returns {Object} - Results with pagination metadata
 */
const paginate = async (model, query = {}, reqQuery = {}) => {
    const page = parseInt(reqQuery.page, 10) || 1;
    const limit = parseInt(reqQuery.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const search = reqQuery.search || '';

    let finalQuery = { ...query };

    if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        const possibleFields = ['name', 'email', 'title', 'content', 'fileName', 'description', 'location', 'extractedData.patientName'];
        const orConditions = [];

        possibleFields.forEach(field => {
            // Check if field exists in schema (including nested fields)
            if (model.schema.path(field) || field.includes('.')) {
                orConditions.push({ [field]: searchRegex });
            }
        });

        if (orConditions.length > 0) {
            const searchOr = { $or: orConditions };
            if (finalQuery.$or) {
                // If we already have an $or (e.g. from permission checks), we must combine them with $and
                const originalOr = { $or: finalQuery.$or };
                delete finalQuery.$or;
                finalQuery.$and = [originalOr, searchOr];
            } else {
                finalQuery.$or = orConditions;
            }
        }
    }

    const [data, total] = await Promise.all([
        model.find(finalQuery).sort({ createdAt: -1 }).skip(skip).limit(limit),
        model.countDocuments(finalQuery)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            total,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

module.exports = paginate;
