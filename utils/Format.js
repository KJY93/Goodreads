const format = (handlebarViewsTemplate, res) => {
    const hvt = handlebarViewsTemplate
    
    const resFormat = (...params) => {
        const recs = params[0]
        
        res.status(200)
        res.format({
            'text/html': () => {
                res.type('text/html')
                res.render(hvt, 
                    recs,
                )
            },
            'application/json': () => {
                res.type('application/js')
                res.json(recs)
            },
            default: () => {
                // Log the request and respond with 406 if the MIME type is not supported
                res.status(406).send('Not Acceptable')             
            }
        })
    }

    return resFormat
}

module.exports = { format }