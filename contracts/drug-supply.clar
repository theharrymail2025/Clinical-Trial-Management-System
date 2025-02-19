;; Drug Supply Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-insufficient-supply (err u103))

;; Data Variables
(define-data-var last-drug-id uint u0)

;; Data Maps
(define-map drugs
  { drug-id: uint }
  {
    name: (string-ascii 50),
    description: (string-utf8 500),
    total-supply: uint,
    remaining-supply: uint
  }
)

(define-map drug-distributions
  { distribution-id: uint }
  {
    drug-id: uint,
    patient: principal,
    amount: uint,
    timestamp: uint,
    distributor: principal
  }
)

(define-map patient-adherence
  { patient: principal, drug-id: uint }
  {
    doses-taken: uint,
    last-dose-timestamp: uint
  }
)

(define-map authorized-distributors
  { trial-id: uint, distributor: principal }
  { authorized: bool }
)

;; Private Functions

(define-private (is-authorized-distributor (trial-id uint) (distributor principal))
  (default-to false (get authorized (map-get? authorized-distributors { trial-id: trial-id, distributor: distributor })))
)

;; Public Functions

;; Add a new drug
(define-public (add-drug (name (string-ascii 50)) (description (string-utf8 500)) (total-supply uint))
  (let
    (
      (new-id (+ (var-get last-drug-id) u1))
    )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set drugs
      { drug-id: new-id }
      {
        name: name,
        description: description,
        total-supply: total-supply,
        remaining-supply: total-supply
      }
    )
    (var-set last-drug-id new-id)
    (ok new-id)
  )
)

;; Authorize a distributor
(define-public (authorize-distributor (trial-id uint) (distributor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-distributors
      { trial-id: trial-id, distributor: distributor }
      { authorized: true }
    )
    (ok true)
  )
)

;; Distribute drug to a patient
(define-public (distribute-drug (trial-id uint) (drug-id uint) (patient principal) (amount uint))
  (let
    (
      (drug (unwrap! (map-get? drugs { drug-id: drug-id }) err-not-found))
      (distribution-id (+ (var-get last-drug-id) u1))
    )
    (asserts! (is-authorized-distributor trial-id tx-sender) err-unauthorized)
    (asserts! (>= (get remaining-supply drug) amount) err-insufficient-supply)
    (map-set drugs
      { drug-id: drug-id }
      (merge drug { remaining-supply: (- (get remaining-supply drug) amount) })
    )
    (map-set drug-distributions
      { distribution-id: distribution-id }
      {
        drug-id: drug-id,
        patient: patient,
        amount: amount,
        timestamp: block-height,
        distributor: tx-sender
      }
    )
    (var-set last-drug-id distribution-id)
    (ok distribution-id)
  )
)

;; Record patient adherence
(define-public (record-adherence (drug-id uint) (patient principal))
  (let
    (
      (adherence (default-to { doses-taken: u0, last-dose-timestamp: u0 }
                  (map-get? patient-adherence { patient: patient, drug-id: drug-id })))
    )
    (map-set patient-adherence
      { patient: patient, drug-id: drug-id }
      {
        doses-taken: (+ (get doses-taken adherence) u1),
        last-dose-timestamp: block-height
      }
    )
    (ok true)
  )
)

;; Read-only functions

;; Get drug details
(define-read-only (get-drug (drug-id uint))
  (ok (unwrap! (map-get? drugs { drug-id: drug-id }) err-not-found))
)

;; Get distribution details
(define-read-only (get-distribution (distribution-id uint))
  (ok (unwrap! (map-get? drug-distributions { distribution-id: distribution-id }) err-not-found))
)

;; Get patient adherence
(define-read-only (get-patient-adherence (patient principal) (drug-id uint))
  (ok (unwrap! (map-get? patient-adherence { patient: patient, drug-id: drug-id }) err-not-found))
)

;; Initialize contract
(begin
  (var-set last-drug-id u0)
)

