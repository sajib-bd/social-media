import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as FacebookStrategy } from "passport-facebook";
import TokenAndCookie from "../utils/TokenAndCookie.js";
import User from "../models/userModel.js";

const providers = {
    google: {
        Strategy: GoogleStrategy,
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_DOMAIN}/api/v1/user/auth/google/callback`,
        scope: ["profile", "email"],
    },
    github: {
        Strategy: GitHubStrategy,
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_DOMAIN}/api/v1/user/auth/github/callback`,
        scope: ["user:email"],
    },
    facebook: {
        Strategy: FacebookStrategy,
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_DOMAIN}/api/v1/user/auth/facebook/callback`,
        scope: ["email"],
        profileFields: ['id', 'displayName', 'email', 'photos'],
    },
};

const authHandler = async (provider, profile, done) => {
    try {
        let user = await User.findOne({ [`${provider}Id`]: profile.id }) ||
            await User.findOne({ email: profile.emails?.[0]?.value });

        if (!user) {
            const demoProfile = `https://avatar.iran.liara.run/username?username=${profile.displayName || profile.username}`;
            user = await User.create({
                username: profile.username || profile.emails[0].value.split("@")[0],
                fullName: profile.displayName || profile.username || profile.emails[0].value.split("@")[0],
                email: profile.emails?.[0]?.value || "",
                [`${provider}Id`]: profile.id,
                profile: profile.photos?.[0]?.value || demoProfile,
                cover: demoProfile,
                provider,
            });
        }

        await User.findByIdAndUpdate(user._id, { provider, [`${provider}Id`]: profile.id });
        return done(null, user._id);
    } catch (error) {
        console.error(`${provider} authentication error:`, error);
        return done(error, null);
    }
};

Object.entries(providers).forEach(([provider, { Strategy, clientID, clientSecret, callbackURL, scope, profileFields }]) => {
    passport.use(new Strategy({ clientID, clientSecret, callbackURL, scope, profileFields }, (token, tokenSecret, profile, done) => {
        authHandler(provider, profile, done);
    }));
});

export const authRouter = (provider) => passport.authenticate(provider, { scope: providers[provider].scope });
export const authRouterCallback = (provider) => async (req, res) => {
    passport.authenticate(provider, { failureRedirect: "/author", session: false }, async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ message: "Authentication failed", error: err });
        }

        try {
            await TokenAndCookie(user, res);
            return res.redirect('https://matrix-media.vercel.app');

        } catch (error) {
            return res.status(500).json({ message: "Error processing authentication" });
        }
    })(req, res);
};
