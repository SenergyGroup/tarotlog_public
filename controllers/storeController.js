const store_get = (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            console.error("[ERROR] User is not authenticated.");
            return res.redirect('/');
        }
        res.render('store', { user: res.locals.user });
    } catch {
        return res.redirect('/');
    }
};

module.exports = { store_get };
