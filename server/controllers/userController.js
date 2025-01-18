import validator from "validator";
import bcrypt from "bcrypt";
import random from "r-password";
import mongoose from "mongoose";
import multer from "multer";

import User from "../models/userModel.js";
import { Mail } from "../utils/mail.js";
import TokenAndCookie from "../utils/TokenAndCookie.js";
import {
  NewAccount,
  OtpMail,
  PasswordResetSuccess,
} from "../utils/mailTemplate.js";
import storage from "../utils/cloudinary.js";

const phoneRegex = /^(?:\+88|0088)?(01[3-9]\d{8})$/;
const usernameRegex = /^[a-zA-Z0-9]+$/;

export const SignUp = async (req, res) => {
  try {
    const { username, fullName, email, phone, password } = req.body;

    if (!fullName || !password || !email || !username) {
      return res.status(400).json({
        message: "All fields must be provided",
      });
    }

    if (fullName === "" || password === "" || email === "" || username === "") {
      return res.status(400).json({
        message: "Fields cannot be empty",
      });
    }

    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message: "Username should contain only alphanumeric characters.",
      });
    }

    if (username == "me") {
      return res.status(400).json({
        message: "Username can't be 'me'. Please choose a different one.",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        message: "Invalid email address. Please check the format!",
      });
    }

    if (phone) {
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Invalid phone number. Use a valid Bangladeshi number.",
        });
      }
    }

    const userNameExists = await User.findOne({ username });

    if (userNameExists) {
      return res.status(400).json({
        message: "Username already exists. Please choose a different one.",
      });
    }

    const userExists = await User.findOne({
      $or: [{ email: email }, { phone: phone }],
    });

    if (userExists) {
      if (userExists.email == email) {
        return res.status(400).json({
          message: "User already exists with this email.",
        });
      }

      if (userExists.phone == phone) {
        return res.status(400).json({
          message: "User already exists with this phone number.",
        });
      }
    }

    if (password < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    if (!validator.isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    const demoProfile = `https://avatar.iran.liara.run/username?username=${fullName.replaceAll(
      " ",
      "+"
    )}`;

    const userCreate = await User.create({
      username,
      fullName,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      profile: demoProfile,
      cover: demoProfile,
      provider: "email",
      visitorId: "",
    });

    if (!userCreate) {
      return res.status(400).json({
        message: "Account creation failed. Check your info and try again.",
      });
    }

    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h12",
    })
      .format(new Date(userCreate.createdAt))
      .replace(",", "")
      .replaceAll("/", "-");
    Mail(email, "New Account Create", NewAccount(fullName, email, phone, date));
    return res.status(201).json({
      message: "Congratulations! Your account has been successfully created!",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const Login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { token } = req.cookies;
    if (token) {
      return res.status(400).json({
        status: "login",
        message: "Already logged in",
      });
    }

    if (!username || !password) {
      return res.status(403).json({
        message: "All fields are required",
      });
    }

    if (username == "" || password == "") {
      return res.status(400).json({
        message: "Fields cannot be empty",
      });
    }

    const findUser = await User.findOne({
      $or: [{ username }, { email: username }, { phone: username }],
    });

    if (!findUser) {
      return res.status(404).json({
        message: "Account not found. Check credentials or register",
      });
    }

    const MatchPassword = await bcrypt.compare(password, findUser.password);
    if (!MatchPassword) {
      return res.status(400).json({
        message: "Incorrect password. Please try again.",
      });
    }

    await TokenAndCookie(findUser._id, res);

    await User.findByIdAndUpdate(
      findUser._id,
      { lastLogin: new Date() },
      { new: true }
    );
    return res.status(200).json({
      message: "Login successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const Logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
    });
    return res.status(200).json({
      message: "Logout Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const Profile = async (req, res) => {
  try {
    const { id } = req.headers;
    const { username } = req.params;
    if (username != "me") {
      if (!(await User.findOne({ username }))) {
        return res.status(404).json({
          message: "This username has no profile",
        });
      }
    }
    const profile = await User.aggregate([
      {
        $match: {
          $expr: {
            $cond: {
              if: { $eq: [username, "me"] },
              then: { $eq: ["$_id", id] },
              else: { $eq: ["$username", username] },
            },
          },
        },
      },
      {
        $lookup: {
          from: "posts",
          localField: "_id",
          foreignField: "likes",
          as: "likedPosts",
        },
      },
      {
        $addFields: {
          followers: {
            $size: "$followers",
          },
          following: {
            $size: "$following",
          },
          postLike: {
            $size: "$likedPosts",
          },
          postSave: {
            $size: "$postSave",
          },
          myProfile: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: true,
              else: false,
            },
          },
          isFollowing: {
            $cond: {
              if: { $ne: [id, "$_id"] },
              then: {
                $cond: {
                  if: { $in: [id, "$followers"] },
                  then: true,
                  else: false,
                },
              },
              else: "$$REMOVE",
            },
          },
        },
      },
      {
        $project: {
          username: 1,
          fullName: 1,
          email: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: "$email",
              else: "$$REMOVE",
            },
          },
          phone: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: "$phone",
              else: "$$REMOVE",
            },
          },
          profile: 1,
          cover: 1,
          provider: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: "$provider",
              else: "$$REMOVE",
            },
          },
          facebookId: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: "$facebookId",
              else: "$$REMOVE",
            },
          },
          googleId: {
            $cond: {
              if: { $eq: [id, "$_id"] },
              then: "$googleId",
              else: "$$REMOVE",
            },
          },
          bio: 1,
          currentAddress: 1,
          mediaLink: 1,
          followers: 1,
          following: 1,
          postLike: 1,
          postSave: 1,
          myProfile: 1,
          isFollowing: 1,
        },
      },
    ]);

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const ProfilePicUpdate = async (req, res) => {
  try {
    const upload = multer({ storage }).fields([
      { name: "profile", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]);

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }

      const files = req.files || {};
      const profile = files.profile;
      const cover = files.cover;

      if (!profile && !cover) {
        return res.status(400).json({
          message: "Please provide at least one image.",
        });
      }

      const updateData = {};

      if (profile) {
        updateData.profile = profile[0].path;
      }

      if (cover) {
        updateData.cover = cover[0].path;
      }

      const profileImgUpdate = await User.findByIdAndUpdate(
        req.headers.id,
        updateData,
        {
          new: true,
        }
      );
      return res.status(200).json({
        message: "Profile pic updated successfully.",
      });
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const ProfileInfoUpdate = async (req, res) => {
  try {
    const {
      fullName,
      username,
      bio,
      currentAddress,
      oldPassword,
      newPassword,
    } = req.body;

    if (
      !fullName &&
      !username &&
      !bio &&
      currentAddress &&
      !newPassword &&
      !oldPassword
    ) {
      return res.status(400).json({
        message: "Please fill in at least one field.",
      });
    }

    const user = await User.findById(req.headers.id);

    if (username) {
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          message: "Username should contain only alphanumeric characters.",
        });
      }

      if (username == user.username) {
        return res.status(400).json({
          message: "Username cannot be the same as the current username.",
        });
      }

      const usernameFind = await User.findOne({ username }).select({
        _id: 0,
        username: 1,
      });
      if (usernameFind) {
        return res.status(400).json({
          message: "Username is already taken.",
        });
      }
    }
    if (oldPassword || newPassword) {
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          message: "Both old and new passwords must be provided.",
        });
      }

      if (!(await bcrypt.compare(oldPassword, user.password))) {
        return res.status(400).json({
          message: "Incorrect old password. Please try again.",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "Password should be at least 6 characters long.",
        });
      }

      if (!validator.isStrongPassword(password)) {
        return res.status(400).json({
          message:
            "Password should contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        });
      }

      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({
          message: "New password should not be the same as the old password.",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    const profileUpdate = await User.findByIdAndUpdate(
      req.headers.id,
      {
        fullName,
        username,
        bio,
        currentAddress,
        password: user.password,
      },
      { new: true }
    );
    return res.status(200).json({
      message: "Profile info updated successfully!",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const ForgetOTP = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(404).json({
        message: "Please Provide Email Address",
      });
    }

    const find = await User.findOne({ email: email });
    if (!find) {
      return res.status(404).json({
        message:
          "We couldn't find an account associated with this email address. Please check and try again!",
      });
    }

    if (find.otp.expired - 180000 > new Date().getTime()) {
      const minuteCat = find.otp.expired - 180000;
      const time = minuteCat - new Date().getTime();
      const showTime = time / 1000;
      return res.status(400).json({
        message: `OTP  has already send to you email. please try again ${showTime.toFixed(
          0
        )} seconds later`,
      });
    }
    const OTP = await random(6, true, false, false, false);

    await Mail(email, "MATRIX OTP", OtpMail(OTP));
    const update = await User.findByIdAndUpdate(find._id, {
      $set: {
        "otp.code": OTP,
        "otp.expired": new Date().getTime() + 5 * 60 * 1000,
      },
    });

    if (!update) {
      return res.status(404).json({
        message: "Sorry, Something Wrong",
      });
    }

    return res.status(200).json({
      message: "Mail sent successfully Please check your mail box",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const PasswordReset = async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (
      !email ||
      !code ||
      !password ||
      email == "" ||
      code == "" ||
      password == ""
    ) {
      return res.status(404).json({
        message: "All fields are required and cannot be empty",
      });
    }
    if (!validator.isEmail(email)) {
      return res.status(404).json({
        message: "Invalid email address",
      });
    }

    const checkEmailInfo = await User.findOne({ email });

    if (!checkEmailInfo) {
      return res.status(404).json({
        message: "No account found with this email address.",
      });
    }

    if (checkEmailInfo.otp.code != code) {
      return res.status(400).json({
        message: "This OTP Wrong. Please Provide Correct OTP",
      });
    }

    if (checkEmailInfo.otp.expired < new Date().getTime()) {
      return res.status(400).json({
        message: "The OTP has expired. Please request a new one.",
      });
    }

    const passwordCheck = await bcrypt.compare(
      password,
      checkEmailInfo.password
    );

    if (passwordCheck) {
      return res.status(400).json({
        message: "New password must be different from the current one.",
      });
    }

    if (password <= 6) {
      return res.status(400).json({
        message:
          "our password must be at least 6 characters long. Please try again!",
      });
    }

    const Update = await User.findByIdAndUpdate(
      checkEmailInfo._id,
      {
        password: await bcrypt.hash(password, 10),
        expired: new Date().getTime(),
      },
      { new: true }
    );

    if (!Update) {
      return res.status(400).json({
        message: "Password Update Field",
      });
    }

    Mail(
      email,
      "Password Reset",
      "",
      PasswordResetSuccess(checkEmailInfo?.fullName)
    );
    return res.status(200).json({
      message: "Password Reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};

export const Follow = async (req, res) => {
  try {
    if (!validator.isMongoId(req.params.postId)) {
      return res.status(400).json({
        message: "Invalid postId",
      });
    }
    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const { id } = req.headers;
    if (id.toString() == userId.toString()) {
      return res.status(400).json({
        message: "You can't follow yourself",
      });
    }
    const findUser = await User.findById(userId).select({ followers: 1 });
    if (findUser.followers.toString().includes(userId)) {
      const updateFollowers = await User.findByIdAndUpdate(
        id,
        {
          $pull: { followers: id },
        },
        { new: true }
      );
      return res.status(200).json({
        message: "Unfollowed Successfully",
      });
    }
    const updateFollowing = await User.findByIdAndUpdate(
      id,
      {
        $push: { followers: id },
      },
      { new: true }
    );
    return res.status(200).json({
      message: "Followed Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while processing your request.",
    });
  }
};
