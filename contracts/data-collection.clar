;; Data Collection Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-invalid-data (err u103))

;; Data Maps
(define-map trial-data
  { trial-id: uint, patient: principal, data-point-id: uint }
  {
    data-type: (string-ascii 20),
    value: (string-utf8 500),
    timestamp: uint
  }
)

(define-map authorized-data-collectors
  { trial-id: uint, collector: principal }
  { authorized: bool }
)

(define-map data-point-counters
  { trial-id: uint }
  { counter: uint }
)

;; Public Functions

;; Authorize a data collector for a trial
(define-public (authorize-data-collector (trial-id uint) (collector principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-data-collectors
      { trial-id: trial-id, collector: collector }
      { authorized: true }
    )
    (ok true)
  )
)

;; Add data for a patient in a trial
(define-public (add-data (trial-id uint) (patient principal) (data-type (string-ascii 20)) (value (string-utf8 500)))
  (let
    (
      (collector-authorized (default-to { authorized: false } (map-get? authorized-data-collectors { trial-id: trial-id, collector: tx-sender })))
      (current-counter (get counter (default-to { counter: u0 } (map-get? data-point-counters { trial-id: trial-id }))))
      (data-point-id (+ current-counter u1))
    )
    (asserts! (get authorized collector-authorized) err-unauthorized)
    (asserts! (or (is-eq data-type "numerical") (is-eq data-type "text")) err-invalid-data)
    (map-set trial-data
      { trial-id: trial-id, patient: patient, data-point-id: data-point-id }
      {
        data-type: data-type,
        value: value,
        timestamp: block-height
      }
    )
    (map-set data-point-counters
      { trial-id: trial-id }
      { counter: data-point-id }
    )
    (ok data-point-id)
  )
)

;; Read-only functions

;; Get data for a patient in a trial
(define-read-only (get-patient-data (trial-id uint) (patient principal) (data-point-id uint))
  (ok (unwrap! (map-get? trial-data { trial-id: trial-id, patient: patient, data-point-id: data-point-id }) err-not-found))
)

;; Check if a data collector is authorized for a trial
(define-read-only (is-authorized-collector (trial-id uint) (collector principal))
  (ok (get authorized (default-to { authorized: false } (map-get? authorized-data-collectors { trial-id: trial-id, collector: collector }))))
)

;; Get the total number of data points for a trial
(define-read-only (get-data-point-count (trial-id uint))
  (ok (get counter (default-to { counter: u0 } (map-get? data-point-counters { trial-id: trial-id }))))
)

