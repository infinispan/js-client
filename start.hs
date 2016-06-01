#!/usr/bin/env stack
-- stack --install-ghc runghc --package turtle

{-# LANGUAGE OverloadedStrings #-}

import Turtle
import Control.Concurrent.Async

type PortOffset = Int
type NodeName = Text

-- TODO: Get Infinispan Home from environment variable, e.g. ISPN_HOME or JBOSS_HOME
ispnHome = "/opt/infinispan-server"
ispnSh = "/infinispan-server/bin/standalone.sh"
clusteredStandaloneSh = "/infinispan-server/bin/standalone.sh -c clustered.xml"
clusterOpts = "-Djboss.node.name="%s%" \
    \-Djboss.socket.binding.port-offset="%d%" \
    \-Djgroups.join_timeout=1000"
addUserSh = ""%fp%"/infinispan-server/bin/add-user.sh -u admin -p 'mypassword'"

mkTmpDir :: Text -> Shell Turtle.FilePath
mkTmpDir s = using (mktempdir "/tmp" s)

cpR :: Text -> Turtle.FilePath -> Text
cpR src dst = format ("cp -r "%s%" "%fp%"") src dst

addUser :: Turtle.FilePath -> Text
addUser path = format (addUserSh) path

exec :: MonadIO io => Text -> io ExitCode
exec cmd = shell cmd empty

asyncExec :: Text -> Shell (Async ExitCode)
asyncExec = using . fork . exec

startServer :: Turtle.FilePath -> Shell (Async ExitCode)
startServer h = asyncExec $ (format fp h) <> ispnSh

startClusterServer :: Turtle.FilePath -> Text -> Shell (Async ExitCode)
startClusterServer h ps = asyncExec $ (format fp h) <> clusteredStandaloneSh <> " " <> ps

launchLocalNode :: Shell (Async ExitCode)
launchLocalNode = do
    dir <- mkTmpDir "local"
    _   <- exec (cpR ispnHome dir)
    _   <- exec (addUser dir)
    startServer dir

mkClusterOpts :: NodeName -> PortOffset -> Text
mkClusterOpts n p = format (clusterOpts) n p

launchClusterNode :: NodeName -> PortOffset -> Shell (Async ExitCode)
launchClusterNode n p = do
    _ <- (sleep 2.0)
    dir <- mkTmpDir "cluster"
    _   <- exec (cpR ispnHome dir)
    _   <- exec (addUser dir)
    startClusterServer dir (mkClusterOpts n p)

main = sh (do
    local      <- launchLocalNode
    cluster1   <- launchClusterNode "node1" 100
    cluster2   <- launchClusterNode "node2" 200
    cluster3   <- launchClusterNode "node3" 300
    -- TODO: Check that cluster forms
    _ <- liftIO (wait local)
    _ <- liftIO (wait cluster1)
    _ <- liftIO (wait cluster2)
    liftIO (wait cluster3))
