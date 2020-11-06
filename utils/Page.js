// SQL Queries
SQL_GET_BOOK_BY_NAME = 'select * from book2018 WHERE title like ? order by title asc limit ? offset ?'
SQL_GET_BOOKS_TOTAL_COUNT = 'select count(*) as count from book2018 where title like ?'

// Declaring constants
const LIMIT = 10

module.exports = async function getPage (res, getTitle, conn, currOffsetIndex, prevOffsetIndex, nextOffsetIndex) {
    try {
        // Query DB with q, LIMIT and offset
        const [recs, _] = await conn.query(SQL_GET_BOOK_BY_NAME, [ `${getTitle}%`, LIMIT, currOffsetIndex ])

        // Query DB to get total count for that query term
        const [recsCount, __] = await conn.query(SQL_GET_BOOKS_TOTAL_COUNT, [ `${getTitle}%`])

        res.status(200)
        res.format({
            'text/html': () => {
                res.type('text/html')
                res.render('booklist', {
                    recs,
                    hasContent: recs.length > 0,
                    getTitle,
                    field: recs.length > 0 && Object.keys(recs[0]),
                    currOffsetIndex: currOffsetIndex !== 0 && 1, // for first page (to display the next button and without the prev button)
                    prevOffsetIndex: `/prev/${getTitle}/${prevOffsetIndex}`, // href link to previous page
                    nextOffsetIndex: `/next/${getTitle}/${nextOffsetIndex}`, // href link to next page 
                    isNotEnd: ((Math.floor(recsCount[0]['count'] / 10) > (nextOffsetIndex / 10))) && 1 , // do not display next button if the current page is the last page
                })
            },
            'application/json': () => {
                res.type('application/json')
                res.json(recs)
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
}