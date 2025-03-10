import { motion } from "framer-motion";
import authorStore from "@/store/authorStore.js";
import {useNavigate, useParams} from "react-router-dom";
import toast from "react-hot-toast";
import {useEffect, useState} from "react";
import LoadingButtonFit from "@/Component/button/LoadingButtonFit.jsx";
import VerifiedBadge from "../utility/VerifyBadge.jsx";

const SearchResultComponent = () => {
  const {user} = useParams();
  const navigate = useNavigate();
  const [followLoader, setFollowLoader] = useState({
    status: false,
    id: null,
  });
  const {clear_followersList, followersReq } =authorStore()
  const {
    followersList,
    flowReq,
    update_followersList
  } = authorStore();

  useEffect(() => {
    (
        async () => {
          clear_followersList()
          await followersReq(user);
        }
    )()
  }, [user]);

  const goToProfile = (user) => {
    navigate("/profile/" + user);
  };

  const followHandel = async (id ,isFollowing) => {
    setFollowLoader({
      status: true,
      id: id,
    });
    let res = await flowReq(id);
    setFollowLoader({
      status: false,
      id: null,
    });
    if (res) {
      if(isFollowing === true) {
        update_followersList(id ,{isFollowing : false});
      }
      if(isFollowing === false) {
        update_followersList(id ,{isFollowing : true});
      }

      toast.success("Action Successful");
    } else {
      toast.error("Action Fail");
    }
  }

  if (followersList != null) {
    return (
      <div className="px-3">
        {followersList.map((user, i) => {
          return (
            <motion.div
              key={i}
              whileHover={{ opacity: 1, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                scale: { type: "spring", stiffness: 300 },
              }}
              className="cursor-pointer flex flex-col items-end  lg:flex-row lg:justify-start lg:items-center gap-4 p-4 border
              ounded-lg shadow-lg mb-2 bg-white hover:shadow-xl transition-shadow"
            >

              <div className="flex justify-start items-center gap-3 w-full">
                <div
                    onClick={() => goToProfile(user.username)}
                    className="h-[50px] w-[50px] flex items-center justify-center rounded-full overflow-hidden border-2
                border-gray-200"
                >
                  <img
                      src={user.profile}
                      alt="User Profile"
                      className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-grow">
                  <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-1">
                  <span
                      onClick={() => goToProfile(user.username)}
                      className="cursor-pointer hover:underline"
                  >
                    {user.fullName}
                  </span>
                    {user.verify && <VerifiedBadge isVerified={user.verify}/>}
                  </h2>
                  <h3
                      onClick={() => goToProfile(user.username)}
                      className="text-sm font-normal text-neutral-600 cursor-pointer"
                  >
                    @{user.username}
                  </h3>
                </div>
              </div>

              {followLoader.id === user._id ? (
                  <LoadingButtonFit/>
              ) : (

                  <button
                      onClick={() => followHandel(user._id, user.isFollowing)}
                      className={`text-sm w-fit font-semibold py-2 px-6 rounded-full transition-colors duration-300 transform ${
                          user.isFollowing
                              ? "bg-red-500 text-white hover:bg-red-700 hover:scale-105"
                              : "bg-sky-600 text-white hover:bg-sky-700 hover:scale-105"
                      }`}
                  >
                    {user.isFollowing ? "Unfollow" : "Follow"}
                  </button>
              )}
            </motion.div>
          );
        })}
        <div className="py-[40px]"></div>
      </div>
    );
  }
  else {
    return (
        <div className="mt-4 px-3">
          {[1, 1, 1,].map((_, i) => {
            return (

                <motion.div
                    key={i}
                    className="flex items-center gap-4 p-4 border rounded-lg shadow-md animate-pulse bg-white"
                >
                  <div className="h-12 w-12 bg-gray-300 rounded-full"></div>
                  <div className="flex flex-col flex-grow space-y-2">
                    <div className="h-4 w-1/3 bg-gray-300 rounded"></div>
                    <div className="h-4 w-1/4 bg-gray-300 rounded"></div>
                  </div>
                  <div className="h-8 w-24 bg-gray-300 rounded-full"></div>
                </motion.div>
            );
          })}
        </div>
    );
  }
};

export default SearchResultComponent;
