const paginate = (model) => {
    return async (req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const results = {};

        try {
            const total = await model.countDocuments();
            results.total = total;
            results.page = page;
            results.limit = limit;
            results.totalPages = Math.ceil(total / limit);

            if (endIndex < total) {
                results.next = {
                    page: page + 1,
                    limit: limit
                };
            }

            if (startIndex > 0) {
                results.previous = {
                    page: page - 1,
                    limit: limit
                };
            }

            results.data = await model.find().limit(limit).skip(startIndex).exec();
            res.paginatedResults = results;
            next();
        } catch (e) {
            res.status(500).json({ message: e.message });
        }
    };
};

module.exports = paginate;
