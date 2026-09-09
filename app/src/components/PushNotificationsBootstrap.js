import React, {
  useEffect,
  useRef,
} from "react";

import {
  useAuth,
} from "../context/AuthProvider";

import {
  registerDeviceForPushNotifications,
} from "../services/pushNotifications";


export default function PushNotificationsBootstrap() {
  const {
    user,
    booting,
  } = useAuth();


  const registeredForUser =
    useRef(null);


  useEffect(() => {
    if (booting) {
      return;
    }


    if (!user?.id) {
      registeredForUser.current =
        null;

      return;
    }


    /*
     * لا نكرر التسجيل بنفس جلسة التطبيق.
     */
    if (
      registeredForUser.current
      === user.id
    ) {
      return;
    }


    registeredForUser.current =
      user.id;


    void registerDeviceForPushNotifications();

  }, [
    user?.id,
    booting,
  ]);


  return null;
}