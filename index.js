const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, Collection, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://bid-hotels.web.app','https://bid-hotels.firebaseapp.com' ],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))


const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

// 
// 



const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.iimwc2a.mongodb.net/?retryWrites=true&w=majority`;
// Create a new MongoClient
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});




async function run() {
  try {

    // database Collection 
    const usersCollection = client.db('hostelMaster').collection('users')
    const roomsCollection = client.db('hostelMaster').collection('rooms') 
    const bookingCollection = client.db('hostelMaster').collection('bookings') 
    const confirmRoomCollection = client.db('hostelMaster').collection('confirmRooms') 





    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // Logout user and remove the token 
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })




    // Save or modify user email, when user login to the database 
    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
    
      if (isExist){
        if(user?.status === "Requested"){
          const result = await usersCollection.updateOne(
            query,
            {
              $set: user,
            },
            options
          )
          return res.send(result)
        }
        else{
          return res.send(isExist)
        }
      }
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    })



     // get user roll 
     app.get('/user/:email', async(req, res) =>{
      try {
        const email = req.params.email
        const result = await usersCollection.findOne({email})
        res.send(result)
      } catch (error) {
        console.log(error)
      }
    })




// get rooms 

app.get('/rooms', async(req, res) =>{
  try {
    const result = await roomsCollection.find().toArray()
    res.send(result)
    
  } catch (error) {
    console.log(error)
  }
})

// get all rooms
app.get('/allrooms', async(req, res) =>{
  try {
    const filter = req.query
    const query = {
      area: { $regex: filter.search, $options: 'i'}
    }
    console.log(query)
    const result = await roomsCollection.find(query).toArray()
    res.send(result)
    
  } catch (error) {
    console.log(error)
  }
})


// get a single by id 
app.get('/rooms/:id', async(req, res) =>{
  try {
    const id = req.params.id 
  const query = {_id: new ObjectId(id)}
  const result = await roomsCollection.findOne(query)
  res.send(result)
  
  } catch (error) {
    console.log(error)
  }
})


// get rooms by host / get my rooms 
app.get('/myrooms/:email', async(req, res) =>{
  try {
    const email = req.params.email 
    const result = await roomsCollection.find({ 'host.email' : email}).toArray()
    res.send(result)
  } catch (error) {
    console.log(error)
  }
})


// post roomData in database
app.post('/roomsdata', async (req, res) =>{
  try {
    const rooms = req.body
    const result = await roomsCollection.insertOne(rooms)
    res.send(result)

  } catch (error) {
    console.log(error)
  }
})

// get one room 
app.get('/updateroom/:id', async(req, res) =>{
  const id = req.params.id
  const query = {_id: new ObjectId(id)}
  const result = await roomsCollection.findOne(query)
  res.send(result)

})

// update rooms 
app.patch('/rooms/:id', async(req, res) =>{
  const item = req.body 
  const  id = req.params.id 
  const filter = {_id: new ObjectId(id)}
  const updateDoc = {
   $set:{
    area:item.area,
    bathrooms: item.bathrooms,
    bedrooms:item.bedrooms,
    description:item.description,
    from:item.from,
    image:item.image,
    location:item.location,
    price:item.price,
    title:item.title,
    to:item.to,
   }
  }
const result = await roomsCollection.updateOne(filter, updateDoc)
res.send(result)
})

// delete room 
app.delete('/rooms/:id', async(req, res) =>{
  const id = req.params.id 
  const query = {_id: new ObjectId(id)}
  const result = await roomsCollection.deleteOne(query)
  res.send(result)

})



// confirm room data api 


// post room 
app.post('/confirmroom', async (req, res) => {
  try {
    const rooms = req.body;

    // Generate a new ObjectId
    const newObjectId = new ObjectId();

    // Set _id to the new ObjectId
    rooms._id = newObjectId;

    // Use updateOne to upsert (update or insert) the document based on the custom _id
    const result = await confirmRoomCollection.updateOne(
      { _id: newObjectId }, // Search criteria based on the new ObjectId
      { $set: rooms },      // Set the fields of the document
      { upsert: true }       // Create a new document if it doesn't exist
    );

    // Convert the _id to ObjectId before using it in the deletion query
    const query = { _id:new ObjectId(rooms._id) };
    console.log(query);

    const deleteResult = await roomsCollection.deleteOne(query);

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// booking related api 
app.post('/create-payment-intent', verifyToken, async(req, res) =>{
  const {price} = req.body 
  const amount = parseInt( price * 100)
  
  if(!price || amount < 1) return

  const {client_secret} = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  })
  res.send({clientSecret: client_secret})

})


   // save booking info in booking collection 
   app.post('/booking', async (req, res) =>{
    const booking = req.body 
    const result = await bookingCollection.insertOne(booking)

    // send email 

    res.send(result)
  })


      // update room booking status 
      app.patch('/rooms/status/:id', async(req, res) =>{
        const id = req.params.id 
        const status = req.body.status
        const query = { _id: new ObjectId(id)}
        const updateDoc = {
          $set:{
            booked: status
          }
        }
        const result = await roomsCollection.updateOne(query, updateDoc)
        res.send(result)
      })
  

    // get all bookings for guest 
    app.get('/bookings', verifyToken, async(req, res) =>{
      const email = req.query.email 
      if(!email) return res.send([])

      const query = {'guest.email' : email}
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })


    // get all bookings for host by email query 
    app.get('/bookings/host', verifyToken, async(req, res) =>{
      const email = req.query.email 
      if(!email) return res.send([])

      const query = {'host' : email}
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

      // get all users data for manage users in admin route 
      app.get('/allusers/admin', verifyToken, async( req, res) =>{
      
        const result = await usersCollection.find().toArray()
        res.send(result)
        
      })
  
  
      // update user role 
      app.put('/update/role/:email', async(req, res) =>{
        const email = req.params.email
        const user = req.body 
        const query = {email : email}
        const options = { upsert: true}
        const updateDoc = {
          $set:{
            ...user, timestamp: Date.now()
          }
        }
        const result = await usersCollection.updateOne(query, updateDoc, options)
        res.send(result)
      })
  
 // Admin Stat Data for admin state
 app.get('/admin-stat',  async (req, res) => {
  const bookingsDetails = await bookingCollection.find({}, { projection: { date: 1, price: 1 } })
    .toArray()
  const userCount = await usersCollection.countDocuments()
  const roomCount = await roomsCollection.countDocuments()
  const totalSale = bookingsDetails.reduce(
    (sum, data) => sum + data.price,
    0
  )

  const chartData = bookingsDetails.map(data => {
    const day = new Date(data.date).getDate()
    const month = new Date(data.date).getMonth() + 1
    return [day + '/' + month, data.price]
  })
  chartData.unshift(['Day', 'Sale'])
  res.send({
    totalSale,
    bookingCount: bookingsDetails.length,
    userCount,
    roomCount,
    chartData,
  })
})




    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from hostelMaster Server..')
})

app.listen(port, () => {
  console.log(`hostelMaster is running on port ${port}`)
})
