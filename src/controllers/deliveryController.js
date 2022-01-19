const Delivery = require('../models/Delivery');
const Driver = require('../models/Driver');

const { calculateDeliveryAmount, calculateDistance, setDeliveryType } = require('../helpers/delivery');
const { deliverySchema } = require('../helpers/validation');

// Get all deliveries
const get = async (req, res, next) => {
  try {
    const result = await Delivery.find().populate('driver');
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// Get available deliveries for a driver based on his truck type, delivery weight,
// availability (true), region (Local) and type (National)
const getBy = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.user._id }).populate('truck');
    if (driver) {
      let minWeight;
      let maxWeight;
      switch (driver.truck.type) {
        case 'Light':
          minWeight = 0;
          maxWeight = 200;
          break;
        case 'Medium':
          minWeight = 201;
          maxWeight = 800;
          break;
        case 'Heavy':
          minWeight = 801;
          maxWeight = 1600;
          break;
        default:
          minWeight = 0;
          maxWeight = 200;
          break;
      }
      const response = await Delivery.find(
        {
          weight: { $gte: minWeight, $lte: maxWeight },
          region: 'Local',
          type: 'National',
          available: true,
          driver: { $exists: false },
        },
      );
      if (response.length > 0) {
        res.json(response);
      } else {
        res.json({ message: 'There is no available deliveries for you.' });
      }
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
};

// Get all deliveries claimed by a driver
const getClaimed = async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ _id: req.user._id }).populate('truck');
    const response = await Delivery.find(
      {
        driver: driver._id,
      },
    );
    if (response.length > 0) {
      res.json(response);
    } else {
      res.json({ message: 'You have not claimed any deliveries yet.' });
    }
  } catch (error) {
    next(error);
  }
};

// Create delivery, calculate amount based on weight and region, set delivery type based on region
const create = async (req, res, next) => {
  try {
    const result = deliverySchema.validate(req.body);
    if (!result.error) {
      const newDelivery = new Delivery({
        weight: req.body.weight,
        amount: calculateDeliveryAmount(req.body.weight, req.body.region),
        region: req.body.region,
        from: req.body.from,
        to: req.body.to,
        distance: await calculateDistance(req.body.from, req.body.to),
        date: req.body.date,
        type: setDeliveryType(req.body.region),
      });
      const response = await newDelivery.save();
      res.json({ message: 'Delivery was created successfully.', delivery: response });
    } else {
      res.status(422);
      __log.error(result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    res.status(500);
    next(error);
  }
};

// Update all deliveries that are not available (false) and have no driver to available (true)
const update = async (req, res, next) => {
  try {
    const query = {
      available: false,
      driver: { $exists: false },
    };
    const response = await Delivery.updateMany(
      query,
      {
        available: true,
      },
    );
    // This will leave deliveries that are already claimed unavailable
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Claim a delivery by adding driver _id and make it unavailable (false)
const claim = async (req, res, next) => {
  const { id: _id } = req.params;
  try {
    const findQuery = {
      _id: req.user._id,
    };
    const driver = await Driver.findOne(findQuery);
    if (driver) {
      const updateQuery = {
        _id,
        available: true,
        driver: { $exists: false },
      };
      const updatedDelivery = {
        available: false,
        driver: req.user._id,
      };
      const responseDelivery = await Delivery.findOneAndUpdate(
        updateQuery,
        { $set: updatedDelivery },
        { new: true },
      );
      if (responseDelivery) {
        const driverQuery = {
          _id: req.user._id,
        };
        const updatedDriver = {
          distanceTraveled: driver.distanceTraveled + responseDelivery.distance,
        };
        const responseDriver = await Driver.findOneAndUpdate(
          driverQuery,
          { $set: updatedDriver },
          { new: true },
        );
        res.json({ delivery: responseDelivery, driver: responseDriver });
      } else {
        next();
      }
    } else {
      next();
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  getBy,
  getClaimed,
  create,
  update,
  claim,
};
