// Loading libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')
const fetch = require('node-fetch')
const withQuery = require('with-query').default
const getPage = require('./utils/Page.js')
const morgan = require('morgan')

// Configuring port
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

// Creating database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'goodreads',
    password: process.env.DB_PASSWORD,
    user: process.env.DB_USER,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
})

// Declaring constants
const OFFSET_LIMIT = 10
const API_BASE_URL = 'https://api.nytimes.com/svc/books/v3/reviews.json'
const API_KEY = process.env.API_KEY || ""

// SQL Query
SQL_GET_BOOK_BY_ID = 'select * from book2018 WHERE book_id = ?'

const startApp = async (app, pool) => {
    try {
        // Acquiring connection from connection pool
        const conn = await pool.getConnection()
        console.info('Pinging database...')
        await conn.ping()

        // Releasing the connection
        conn.release()

        // Starting up the server
        if (API_KEY) {
            app.listen(
                PORT, 
                () => {
                    console.info(`Application started on PORT ${PORT} at ${new Date()}`)
                }
            )
        }
        else {
            console.error('Missing API key.')
        }
    }
    catch (err) {
        console.error('Cannot ping database: ', err)
    }
}

// Creating an instance of express application
const app = express()

// Logging HTTP request
app.use(morgan('combined'))

// Loading static files
app.use(
    express.static(__dirname + '/static')
)

// Configuring handlebars 
app.engine('hbs', handlebars({
    defaultLayout: 'default.hbs'
}))
app.set('view engine', 'hbs')

// Routes endpoint
app.get('/', (req, res) => {
    res.status(200)
    res.type('text/html')
    res.render('index')
})

app.get('/book/:titleStartsWith', async (req, res) => {
    // Getting params from url
    let getTitle = req.params.titleStartsWith

    const conn = await pool.getConnection()

    let currOffsetIndex = 0
    let prevOffsetIndex = currOffsetIndex
    let nextOffsetIndex = currOffsetIndex + OFFSET_LIMIT

    getPage (res, getTitle, conn, currOffsetIndex, prevOffsetIndex, nextOffsetIndex)
})

// Prev page
app.get('/prev/:titleStartsWith/:offset', async (req, res) => {
    // Getting params from url
    let getOffset = parseInt(req.params.offset)
    let getTitle = req.params.titleStartsWith
    
    const conn = await pool.getConnection()

    // Setting currOffsetIndex value to the offset value passed in from the url
    let currOffsetIndex = getOffset
    // Minus currOffsetIndex by OFFSET_LIMIT to get prev page index 
    let prevOffsetIndex = currOffsetIndex - OFFSET_LIMIT
    // Add currOffsetIndex by OFFSET_LIMIT to get next page index 
    let nextOffsetIndex = currOffsetIndex + OFFSET_LIMIT

    getPage (res, getTitle, conn, currOffsetIndex, prevOffsetIndex, nextOffsetIndex)

})

// Next page
app.get('/next/:titleStartsWith/:offset', async (req, res) => {
    // Getting params from url
    let getOffset = parseInt(req.params.offset)
    let getTitle = req.params.titleStartsWith

    const conn = await pool.getConnection()

    // Setting currOffsetIndex value to the offset value passed in from the url
    let currOffsetIndex = getOffset
    // Minus currOffsetIndex by OFFSET_LIMIT to get prev page index 
    let prevOffsetIndex = currOffsetIndex - OFFSET_LIMIT
    // Add currOffsetIndex by OFFSET_LIMIT to get next page index 
    let nextOffsetIndex = currOffsetIndex + OFFSET_LIMIT

    getPage (res, getTitle, conn, currOffsetIndex, prevOffsetIndex, nextOffsetIndex)
})

// Get book details
app.get('/bookdetails/:bookId', async (req, res) => {
    let getBookId = req.params.bookId
    const conn = await pool.getConnection()

    try {
        // Query DB for book with book id
        const [recs, _] = await conn.query(SQL_GET_BOOK_BY_ID, [ getBookId ])
        if (recs.length <= 0) {
            res.status(404)
            res.type('text/html')
            res.send(`Book ${getBookId} not found`)
        }
        
        res.status(200)
        res.format({
            'text/html': () => {
                res.type('text/html')
                res.render('details', {
                    recs: recs[0],
                })
            },
            'application/json': () => {
                res.type('application/json')
                res.json(recs[0])
            },
            default: () => {
                // Log the request and respond with 406 if the MIME type is not supported
                res.status(406).send('Not Acceptable')
            }
        })
    }
    catch (err) {
        console.info(err)
        res.status(500)
        res.type('text/html')
        res.send(JSON.stringify(err))
    }
    finally {
        conn.release()
    }
})

// Get book reviews
app.get('/reviews/:bookTitle', async (req, res) => {

    let getBookTitle = (req.params.bookTitle)
    let getBookTitleFirstChar = getBookTitle[0]

    const queryUrl = withQuery(API_BASE_URL, {
        title: getBookTitle.toString(),
        'api-key': API_KEY
    })

    try {
        const response = await fetch(queryUrl)
        const result = (await response.json())
        console.info(result)
        
        res.status(200)
        res.format({
            'text/html': () => {
                res.type('text/html')
                res.render('reviews', {
                    hasContent: result['results'].length > 0,
                    results: result['results'][0],
                    totalReviews: result['results'],
                    copyright: result.copyright,
                    getBookTitleFirstChar,
                })
            },
            'application/json': () => {
                res.type('application/json')
                res.json(result)
            }
        })
    }
    catch (err) {
        console.info(err)
        res.status(500)
        res.send(JSON.stringify(err))
    }
})

startApp(app, pool)

// Handle errors that has unexpectedly occur
app.get('*', function(req, res, next) {
    let err = new Error(`${req.ip} tried to reach ${req.originalUrl}`); // Tells us which IP tried to reach a particular URL
    err.statusCode = 404;
    err.shouldRedirect = true; // New property on err so that our middleware will redirect
    next(err);
  });
  

app.use(function(err, req, res, next) {
    console.error(err.message);
    if (!err.statusCode) err.statusCode = 500; // Sets a generic server error status code if none is part of the err

    if (err.shouldRedirect) {
        res.redirect('/') // Redirect user back to main page if there is an error
    } else {
        res.status(err.statusCode).send(err.message); // If shouldRedirect is not defined in our error, sends our original err data
    }
});
