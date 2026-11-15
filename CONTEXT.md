# JARVIS Domain Context

This file defines the shared language used to design and operate JARVIS. It is a glossary, not an implementation specification.

## Owner

The single human authority for direction, exceptional decisions and risk acceptance. The Owner may delegate execution through explicit autonomy rules, but only the Owner can change the boundary between autonomous and Owner-approved work.

## JARVIS Control Plane

The governed system that owns objectives, plans, approvals, queues, agent jobs, evidence, incidents, deployment requests, audit and reporting. It decides what may happen next; it does not itself pretend to be an engineer, reviewer or operator.

## Project

A bounded venture or operating area whose data, credentials, repositories, workspaces and evidence are isolated from every other project. HotelsVendors is one Project.

## Mission

An Owner or schedule-created statement of intended work before it has an executable plan. A Mission becomes one or more Objectives as work is scoped.

## Objective

A governed, executable outcome with constraints, acceptance criteria, a Plan, an autonomy decision and a report. An Objective is the durable unit of accountability.

## Plan

An ordered set of Tasks proposed to achieve an Objective. A Plan has no authority to execute until the Control Plane applies autonomy policy or receives an Owner decision.

## Task

One bounded unit of execution with an explicit tool, input, lease, retry policy and evidence contract. A Task belongs to exactly one Objective.

## Agent

A named software worker with a declared mandate, allowed tools, model route, project scope and evidence obligations. An Agent definition is not evidence that the Agent is online or competent.

## Runtime

The concrete process or bridge that can execute an Agent's work, such as the VPS worker, Hermes bridge, Codex CLI bridge or Claude Code bridge. A Runtime must heartbeat and prove execution before the Agent is considered connected.

## Agent Job

A dispatched unit of specialist work assigned to a Runtime. An Agent Job carries its project, workspace, model route, autonomy decision, lease and evidence contract.

## Trigger

A named state transition that causes the next bounded action. A Trigger is not a prompt and does not imply permission; it identifies the authoritative handler and the preconditions for action.

## Autonomy Rule

The Owner-defined policy that says whether an action class is autonomous or requires an Owner decision, and the maximum risk it may absorb without escalation.

## Approval Decision

An explicit `yes` or `no` from the Owner, or an equivalent decision from a valid standing autonomy rule. An Approval Decision identifies the exact action, risk, policy reason and decision actor.

## Evidence

Machine-recordable proof produced by execution, such as command output, HTTP response, database snapshot, file hash, commit SHA, diff, test result or deployment status. Evidence is data, not an Agent's claim.

## Verification

An independent check that re-observes the relevant state and compares it with the evidence contract. Only Verification can establish that a Task is verified or an Objective is complete.

## Incident

A normalized failure, drift, policy stop or unexpected state that prevents verified progress or requires diagnosis. Every Incident has a severity, failure class, owner, evidence and next action.

## Repair Action

A bounded recovery action selected from an approved playbook for an Incident. Repair Actions may be autonomous only when their Autonomy Rule allows it; repeated, destructive or unknown failures escalate to the Owner.

## Model Route

The explicit mapping from an Agent, Project and task class to one provider and model, with free-only and enablement constraints. A route may inherit the global JARVIS route.

## Deployment Adapter

A project-specific, approval-gated interface for build and release control. An adapter describes the authorized repository, workflow, workspace, release path, process and health evidence; it does not grant direct production access.

## Trust Domain

A boundary around data, credentials, permissions and external side effects. JARVIS and each Project have separate trust domains even when sharing physical infrastructure.

## Verified Completion

The state reached only when the required Tasks have evidence, independent Verification passes, policy is satisfied, and the final report contains no unresolved blocking Incident.
