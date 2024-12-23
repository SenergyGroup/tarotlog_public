const store_get = (req, res) => {
    res.render('store', { user: res.locals.user });
};

module.exports = { store_get };
